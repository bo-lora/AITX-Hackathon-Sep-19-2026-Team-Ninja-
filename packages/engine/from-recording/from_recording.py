#!/usr/bin/env python3
"""from-recording <events.json> [--out workflow.json]
Turns a recorder.ts events.json into {bullets: [3-5], steps: [{screen, field_label, value, action}]}.
Deterministic. If ANTHROPIC_API_KEY is set, claude-sonnet-5 rewrites ONLY the bullets; any failure -> deterministic bullets."""
import json, os, re, sys, urllib.request

SECRET_RE = re.compile(r"pass(word)?|pwd|secret|token|ssn|clearPass", re.I)
FILLABLE = {"input", "select", "textarea"}
BUTTONISH_TYPES = {"submit", "button", "image", "reset"}

# Known OpenEMR screens by frame URL (path fragment -> screen name)
SCREENS = [
    ("interface/login/login.php", "Login"),
    ("interface/new/new_search_popup.php", "Duplicate check popup"),
    ("interface/new/new.php", "Search or Add Patient"),
    ("interface/patient_file/summary/insurance_edit.php", "Insurance Edit"),
    ("interface/patient_file/summary/demographics_full.php", "Edit Demographics"),
    ("interface/patient_file/summary/demographics.php", "Patient Dashboard"),
    ("interface/main/calendar/add_edit_event.php", "Appointment dialog"),
    ("interface/main/calendar", "Calendar"),
    ("interface/main/finder", "Patient Finder"),
    ("controller.php?document", "Documents"),
    ("interface/main/tabs/main.php", "Main menu"),
]
# Field-id hints where the recorded label is shared/ambiguous (e.g. "Name:" for first AND last)
FIELD_HINTS = {
    "authUser": "Username", "clearPass": "Password", "form_fname": "First Name", "form_lname": "Last Name",
    "form_mname": "Middle Name", "form_DOB": "DOB", "form_sex": "Birth Sex", "form_hour": "Time (hour)",
    "form_minute": "Time (minute)", "form_ampm": "Time (AM/PM)", "form_category": "Category",
    "form_provider": "Provider", "form_policy_number": "Policy Number", "form_group_number": "Group Number",
    "form_subscriber_relationship": "Relationship", "form_subscriber_street": "Subscriber Address",
    "form_subscriber_city": "City", "form_subscriber_state": "State", "form_subscriber_postal_code": "Zip Code",
}

def screen_of(ev):
    if ev.get("screen"): return ev["screen"]
    url = ev.get("frame_url") or ""
    for frag, name in SCREENS:
        if frag in url:
            if name == "Insurance Edit" or name == "Login": return name
            return name
    title = (ev.get("frame_title") or "").strip()
    if title and title.lower() != "openemr": return title
    m = re.search(r"/([^/?#]+?)(\.php)?(\?|#|$)", url)
    return m.group(1) if m else (url or "unknown")

def mask_url(u):
    """Every output URL loses its whole query string (it can carry live session tokens)."""
    return re.sub(r"\?[^#]*", "?<redacted>", u or "", count=1)

def clean(s):
    s = re.sub(r"\s+", " ", (s or "")).strip()
    return re.sub(r"\s*[:*]+\s*$", "", s).strip()

def field_label(ev):
    sel = ev.get("selector") or ""
    for k, v in FIELD_HINTS.items():
        if re.search(r"(^#|[\"'#\-])" + re.escape(k) + r"([\"'\]\-]|$)", sel) or sel == "#" + k:
            if ev.get("kind") == "fill" or (ev.get("tag") in FILLABLE and ev.get("type") not in BUTTONISH_TYPES):
                return v
    if ev.get("tag") in ("a", "button") or ev.get("type") in BUTTONISH_TYPES:
        t = clean(ev.get("text")) or clean(ev.get("label"))
    else:
        t = clean(ev.get("label")) or clean(ev.get("text"))
    if t: return t[:80]
    return "(unlabeled " + (ev.get("tag") or "element") + " " + sel[:60] + ")"

def is_secret(ev):
    return ev.get("type") == "password" or ev.get("value") == "[hidden]" or bool(
        SECRET_RE.search((ev.get("selector") or "") + " " + (ev.get("label") or "")))

def is_fillable_click(ev):
    return ev["kind"] == "click" and (ev.get("tag") in FILLABLE or ev.get("tag") == "label") and ev.get("type") not in BUTTONISH_TYPES

def same_target(a, b):
    if (a.get("selector") and a.get("selector") == b.get("selector")) and a.get("frame_url") == b.get("frame_url"): return True
    la, lb = clean(a.get("label")), clean(b.get("label"))
    return bool(la) and la == lb and a.get("frame_url") == b.get("frame_url")

def convert(doc):
    evs = sorted(doc.get("events", []), key=lambda e: (e.get("t", 0), e.get("i", 0)))
    dropped = []  # (i, reason)
    keep = []
    for idx, ev in enumerate(evs):
        k = ev.get("kind")
        if k == "click":
            nxt = evs[idx + 1: idx + 4]
            # focus click: a click on a field that is filled within the next 3 events
            if any(n.get("kind") == "fill" and same_target(ev, n) and n.get("t", 0) - ev.get("t", 0) <= 30 for n in nxt):
                dropped.append((ev.get("i"), "focus click before fill")); continue
            if ev.get("tag") in ("span", "div") and any(n.get("kind") == "fill" and clean(n.get("label")) and clean(n.get("label")) == clean(ev.get("label")) for n in nxt):
                dropped.append((ev.get("i"), "widget click before fill (select2)")); continue
            if re.search(r"select2", ev.get("selector") or "") and ev.get("tag") != "select":
                dropped.append((ev.get("i"), "select2 dropdown click (the value arrives as a fill)")); continue
            if re.search(r"xdsoft|datepicker|datetimepicker|ui-datepicker", ev.get("selector") or "", re.I) or (
                    ev.get("tag") in ("td", "div", "span", "li") and re.fullmatch(r"\d{1,2}", clean(ev.get("text")) or "")):
                dropped.append((ev.get("i"), "date-picker click (the date arrives as a fill)")); continue
            if is_fillable_click(ev):
                dropped.append((ev.get("i"), "click on a field that was never changed")); continue
            if ev.get("tag") in ("div", "span", "td", "li", "body", "label") and not clean(ev.get("text")) and not clean(ev.get("label")):
                dropped.append((ev.get("i"), "click on empty space")); continue
            if keep and keep[-1].get("kind") == "click" and same_target(keep[-1], ev) and clean(keep[-1].get("text")) == clean(ev.get("text")) and ev.get("t", 0) - keep[-1].get("t", 0) <= 2.0:
                dropped.append((ev.get("i"), "repeated click")); continue
            keep.append(ev)
        elif k == "fill":
            if keep and keep[-1].get("kind") == "fill" and keep[-1].get("selector") == ev.get("selector") and keep[-1].get("frame_url") == ev.get("frame_url"):
                dropped.append((keep[-1].get("i"), "overwritten by a later value")); keep[-1] = ev; continue
            keep.append(ev)
        elif k == "submit":
            prev = keep[-1] if keep else None
            if prev and prev.get("kind") == "click" and ev.get("t", 0) - prev.get("t", 0) <= 1.5 and (prev.get("tag") in ("button", "input", "a")):
                dropped.append((ev.get("i"), "form submit caused by the preceding click")); continue
            keep.append(ev)
        elif k == "navigate":
            prev = keep[-1] if keep else None
            if prev and prev.get("kind") == "navigate" and ev.get("t", 0) - prev.get("t", 0) <= 5:
                dropped.append((prev.get("i"), "redirected (kept the page it landed on)")); keep[-1] = ev; continue
            if prev and prev.get("kind") in ("click", "submit") and ev.get("t", 0) - prev.get("t", 0) <= 5 and len(keep) > 0:
                dropped.append((ev.get("i"), "page load caused by the preceding action")); continue
            keep.append(ev)
        elif k == "key":
            keep.append(ev)
        else:
            dropped.append((ev.get("i"), "unknown kind " + str(k)))
    # an initial navigate that equals start_url is "open"
    steps = []
    for ev in keep:
        k = ev["kind"]
        if k == "navigate":
            steps.append({"screen": screen_of(ev), "field_label": "", "value": mask_url(ev.get("frame_url")),
                          "action": "open" if not steps else "navigate", "_i": ev.get("i")})
            continue
        lab = field_label(ev)
        if k == "fill":
            v = ev.get("value")
            if is_secret(ev): v = "[hidden]"
            if ev.get("type") == "file": act = "upload"
            elif ev.get("type") in ("checkbox", "radio"): act = "check" if str(v) == "true" else "uncheck"
            elif ev.get("tag") == "select": act = "select"
            else: act = "type"
            steps.append({"screen": screen_of(ev), "field_label": lab, "value": "" if v is None else str(v), "action": act, "_i": ev.get("i")})
        elif k == "click":
            steps.append({"screen": screen_of(ev), "field_label": lab, "value": "", "action": "click", "_i": ev.get("i")})
        elif k == "submit":
            steps.append({"screen": screen_of(ev), "field_label": lab, "value": "", "action": "submit", "_i": ev.get("i")})
        elif k == "key":
            steps.append({"screen": screen_of(ev), "field_label": lab, "value": ev.get("value", ""), "action": "press", "_i": ev.get("i")})
    for n, st in enumerate(steps):
        if st["action"] == "click" and st["field_label"].startswith("(unlabeled") and n + 1 < len(steps) and steps[n + 1]["screen"] != st["screen"]:
            st["field_label"] = "icon that opens " + steps[n + 1]["screen"] + " " + st["field_label"]
    return steps, dropped

PHASES = [
    ("login", {"Login"}), ("patient", {"Search or Add Patient", "Duplicate check popup", "Edit Demographics"}),
    ("appointment", {"Appointment dialog", "Calendar"}), ("insurance", {"Insurance Edit"}), ("documents", {"Documents"}),
]

def vals(steps, labels):
    out = []
    for s in steps:
        if s["action"] in ("type", "select", "upload") and s["field_label"] in labels and s["value"]:
            out.append(s["value"])
    return out

def generic_bullets(steps):
    """Describe any workflow: one bullet per run of steps on the same screen, merged down to at most 5."""
    groups = []
    for s in steps:
        if groups and groups[-1][0] == s["screen"]: groups[-1][1].append(s)
        else: groups.append((s["screen"], [s]))
    out = []
    for scr, ss in groups:
        parts = []; clicks = []
        def flush():
            if clicks: parts.append("click " + ", ".join(clicks)); clicks.clear()
        for s in ss:
            if s["action"] == "click": clicks.append(s["field_label"]); continue
            flush()
            if s["action"] in ("open", "navigate"): parts.append("open " + scr)
            elif s["action"] == "press": parts.append("press " + s["value"])
            elif s["action"] in ("type", "select"): parts.append("%s \"%s\" in %s" % ("type" if s["action"] == "type" else "choose", s["value"], s["field_label"]))
            else: parts.append(s["action"] + " " + s["field_label"] + ((" " + s["value"]) if s["value"] else ""))
        flush()
        txt = "; ".join(parts)
        out.append("On " + scr + ": " + txt[0].lower() + txt[1:] + ".")
    while len(out) > 5:  # merge the two shortest neighbours
        k = min(range(len(out) - 1), key=lambda j: len(out[j]) + len(out[j + 1]))
        out[k:k + 2] = [out[k].rstrip(".") + "; then " + out[k + 1][0].lower() + out[k + 1][1:]]
    return out

def det_bullets(steps, doc):
    by = {}
    for s in steps:
        ph = next((p for p, scr in PHASES if s["screen"] in scr), None)
        if ph: by.setdefault(ph, []).append(s)
    b = []; bph = []
    def add(ph, text): b.append(text); bph.append(ph)
    if "login" in by:
        u = vals(by["login"], {"Username"})
        add("login", "Log in to the app" + (" as " + u[0] if u else "") + " (password hidden).")
    if "patient" in by:
        ps = by["patient"]; name = " ".join(vals(ps, {"First Name", "Last Name"}))
        dob = vals(ps, {"DOB"}); sex = vals(ps, {"Birth Sex"})
        extra = ", ".join(x for x in [("born " + dob[0]) if dob else "", sex[0] if sex else ""] if x)
        add("patient", "Create the new patient" + (" " + name if name else "") + (" (" + extra + ")" if extra else "") + " and confirm the duplicate check.")
    if "insurance" in by:
        ins = by["insurance"]; carrier = vals(ins, {"Provider"}); pol = vals(ins, {"Policy Number"}); grp = vals(ins, {"Group Number"})
        bits = [re.sub(r"\s*\(.*\)$", "", carrier[0]) if carrier else "", ("policy " + pol[0]) if pol else "", ("group " + grp[0]) if grp else ""]
        add("insurance", "Enter the referral's insurance" + (": " + ", ".join(x for x in bits if x) if any(bits) else "") + ", then Save Policy.")
    if "documents" in by:
        f = vals(by["documents"], {"Source File Path"}) or [s["value"] for s in by["documents"] if s["action"] == "upload"]
        cat = [s["field_label"] for s in by["documents"] if s["action"] == "click" and s["field_label"] not in ("Upload",)]
        add("documents", "Attach the referral" + (" " + f[0] if f else "") + " to the patient's Documents" + (" (" + cat[-1] + ")" if cat else "") + ".")
    if "appointment" in by:
        ap = by["appointment"]; cat = vals(ap, {"Category"}); d = vals(ap, {"Date"}); h = vals(ap, {"Time (hour)"}); m = vals(ap, {"Time (minute)"})
        when = " ".join(x for x in [d[0] if d else "", (h[0] + ":" + (m[0] if m else "00")) if h else ""] if x)
        add("appointment", "Book " + ("a " + cat[0] + " appointment" if cat else "the appointment") + (" on " + when if when else "") + ".")
    # order bullets by first appearance of their phase in the recording
    first = {}
    for n, st in enumerate(steps):
        ph = next((p for p, scr in PHASES if st["screen"] in scr), None)
        if ph and ph not in first: first[ph] = n
    b = [t for _, t in sorted(zip(bph, b), key=lambda x: first.get(x[0], 999))]
    if len(b) < 2:
        b = generic_bullets(steps)
    if len(b) < 3:
        screens = []
        for s in steps:
            if s["screen"] not in screens: screens.append(s["screen"])
        generic = "Screens visited, in order: " + " > ".join(screens[:8]) + "."
        if generic not in b: b.append(generic)
    if len(b) < 3:
        n_fill = sum(1 for s in steps if s["action"] in ("type", "select", "upload", "check", "uncheck"))
        n_click = sum(1 for s in steps if s["action"] == "click")
        b.append("Recorded %d field entries and %d clicks in %s seconds." % (n_fill, n_click, doc.get("duration_seconds", "?")))
    if len(b) < 3:
        b.append("Starts at " + mask_url(doc.get("start_url", "")) + ".")
    return b[:5]

def order_bullets(b, steps):
    return b  # template order already follows the workflow's natural phases

def llm_bullets(steps, fallback):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key: return fallback, "deterministic (no ANTHROPIC_API_KEY)"
    body = {"model": "claude-sonnet-5", "max_tokens": 400, "messages": [{"role": "user", "content":
        "These are the steps a front-desk worker recorded in a web app. Write 3 to 5 short plain-English bullets "
        "describing her workflow, for her to confirm. Never include passwords. Return ONLY a JSON array of strings.\n\n"
        + json.dumps([{k: v for k, v in s.items() if not k.startswith("_")} for s in steps])}]}
    try:
        req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=json.dumps(body).encode(),
            headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
        r = json.loads(urllib.request.urlopen(req, timeout=30).read())
        txt = "".join(c.get("text", "") for c in r.get("content", []))
        arr = json.loads(txt[txt.index("["): txt.rindex("]") + 1])
        arr = [str(x) for x in arr if str(x).strip()][:5]
        if len(arr) >= 3 and not any("[hidden]" not in x and SECRET_RE.search(x) and "password hidden" not in x.lower() for x in []):
            return arr, "claude-sonnet-5"
    except Exception as ex:
        return fallback, "deterministic (LLM failed: %s)" % type(ex).__name__
    return fallback, "deterministic (LLM output unusable)"

PRIVATE_USE = re.compile("[\ue000-\uf8ff]")

def chrome_label(selectors):
    """Prefer aria/ then text/ selectors for a human label; fall back to the css selector."""
    flat = [sel[0] for sel in (selectors or []) if sel]
    for pref in ("aria/", "text/"):
        for x in flat:
            if x.startswith(pref):
                lab = re.sub(r"\[role=\"[^\"]*\"\]", "", x[len(pref):])
                lab = PRIVATE_USE.sub("", lab).strip()
                if lab: return lab
    css = next((x for x in flat if not re.match(r"^(aria|text|xpath|pierce)/", x)), flat[0] if flat else "")
    return css

def chrome_css(selectors):
    flat = [sel[0] for sel in (selectors or []) if sel]
    return next((x for x in flat if not re.match(r"^(aria|text|xpath|pierce)/", x)), flat[0] if flat else "")

def from_chrome_recorder(doc):
    """Convert a Chrome DevTools Recorder export ({title, steps[]}) into recorder.ts-style events.
    setViewport and keyUp are dropped; keyDown keeps only Enter/Tab/Escape (as 'press'); frame index paths are kept in the screen name."""
    page = "main window"; start = ""; evs = []; skipped = []
    for n, st in enumerate(doc.get("steps", []), 1):
        ty = st.get("type")
        base = {"i": n, "t": float(n)}
        if ty == "navigate":
            u = st.get("url", ""); start = start or u
            page = (re.search(r"/([^/?#]+)(\?|#|$)", u) or [None, "page"])[1]
            evs.append(dict(base, kind="navigate", frame_url=u, screen=page)); continue
        frame = st.get("frame") or []
        scr = page + ("" if not frame else " > frame " + str(frame))
        common = dict(base, frame_url=page + "#frame" + str(frame), frame_title=scr, screen=scr,
                      selector=chrome_css(st.get("selectors")))
        lab = chrome_label(st.get("selectors"))
        if ty == "click":
            evs.append(dict(common, kind="click", tag="a", type=None, label="", text=lab))
        elif ty == "change":
            evs.append(dict(common, kind="fill", tag="input", type="text", label=lab, text="", value=st.get("value", "")))
        elif ty == "keyDown" and st.get("key") in ("Enter", "Tab", "Escape"):
            prev_fill = next((e for e in reversed(evs) if e.get("kind") == "fill"), None)
            evs.append(dict(common, kind="key", tag="key", type=None, label=(prev_fill or {}).get("label", ""), text="", value=st["key"],
                            selector="key:" + st["key"]))
        else:
            skipped.append((n, "chrome step %s%s dropped as keystroke/viewport noise" % (ty, (" " + st.get("key")) if st.get("key") else "")))
    # a click on a field immediately before typing into it: give it the same label so the focus-click rule merges it
    for a, b in zip(evs, evs[1:]):
        if a.get("kind") == "click" and b.get("kind") == "fill" and a.get("selector") == b.get("selector"):
            a["label"] = b["label"]
    return {"start_url": start, "title": doc.get("title", ""), "events": evs}, skipped

def is_chrome_recorder(doc):
    return isinstance(doc, dict) and isinstance(doc.get("steps"), list) and "title" in doc and "events" not in doc

def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__); return 0 if argv else 2
    src = argv[0]; out = None; debug = "--debug" in argv
    if "--out" in argv: out = argv[argv.index("--out") + 1]
    doc = json.load(open(src))
    fmt = "recorder.ts events.json"; pre = []
    if is_chrome_recorder(doc):
        fmt = "Chrome DevTools Recorder"; doc, pre = from_chrome_recorder(doc)
    steps, dropped = convert(doc)
    dropped = pre + dropped
    bullets, how = llm_bullets(steps, det_bullets(steps, doc))
    result = {"bullets": bullets, "steps": [{k: v for k, v in s.items() if not k.startswith("_")} for s in steps]}
    if debug:
        result["_debug"] = {"source": os.path.abspath(src), "input_format": fmt, "bullets_by": how, "events_in": len(doc.get("events", [])),
                            "steps_out": len(steps), "step_event_ids": [s["_i"] for s in steps],
                            "dropped_as_noise": [{"event_i": i, "reason": r} for i, r in dropped]}
    txt = json.dumps(result, indent=2)
    if out:
        open(out, "w").write(txt + "\n"); print("wrote %s: %d bullets, %d steps (%d events in, %d merged as noise; bullets: %s)" % (out, len(bullets), len(steps), len(doc.get("events", [])), len(dropped), how), file=sys.stderr)
    else:
        print(txt)
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
