#!/usr/bin/env python3
"""score.py <workflow.json> <input-label e.g. SAMPLE|scripted|human:path> [--out score.md] [--note "extra line"]
Compares workflow.json steps with ground-truth/workflow.md: matched / missing / extra.
Ground-truth text is quoted verbatim from workflow.md (line looked up by step number)."""
import json, re, sys, os
GT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ground-truth", "workflow.md")

# (gt step, sub-bullet keyword or None, description, action set, label regex, value regex)
EXPECTED = [
    (1, None, "open login page", {"open", "navigate"}, r"", r"login\.php"),
    (2, None, "Username = admin", {"type"}, r"user", r"^admin$"),
    (2, None, "Password (hidden)", {"type"}, r"pass", r"\[hidden\]"),
    (2, None, "click Login", {"click", "submit"}, r"^log ?in$|login", r""),
    (3, None, "open Patient menu", {"click"}, r"^patient$", r""),
    (4, None, "click New/Search", {"click"}, r"new/search", r""),
    (5, None, "First Name", {"type"}, r"first name|fname", r"."),
    (5, None, "Last Name", {"type"}, r"last name|lname", r"."),
    (6, None, "DOB", {"type"}, r"^dob|birth date|date of birth", r"\d{4}-\d{2}-\d{2}"),
    (7, None, "Birth Sex", {"select"}, r"sex", r"."),
    (8, None, "click Create New Patient", {"click"}, r"create new patient", r""),
    (9, None, "click Confirm Create New Patient", {"click"}, r"confirm create", r""),
    (11, None, "Appointments + icon", {"click"}, r"appointment|icon that opens appointment|\+", r""),
    (12, None, "Category = New Patient", {"select"}, r"category", r"new patient|office visit"),
    (13, None, "Date", {"type"}, r"^date", r"\d{4}-\d{2}-\d{2}"),
    (14, None, "Time hour", {"type", "select"}, r"hour|time", r"."),
    (14, None, "Time minute", {"type", "select"}, r"minute", r"."),
    (14, None, "click Save (appointment)", {"click", "submit"}, r"^save$", r""),
    (16, None, "Insurance pencil icon", {"click"}, r"insurance|edit", r""),
    (17, "Relationship", "Relationship = Self", {"select"}, r"relationship", r"self"),
    (17, "Provider", "Provider (carrier)", {"select"}, r"^provider", r"."),
    (17, "Effective Date", "Effective Date", {"type"}, r"effective", r"."),
    (17, "Policy Number", "Policy Number", {"type"}, r"policy number", r"."),
    (17, "Group Number", "Group Number", {"type"}, r"group number", r"."),
    (17, "Subscriber Address", "Subscriber Address", {"type"}, r"subscriber address|street", r"."),
    (17, "Subscriber Address", "City", {"type"}, r"^city", r"."),
    (17, "Subscriber Address", "State", {"select", "type"}, r"^state", r"."),
    (17, "Subscriber Address", "Zip Code", {"type"}, r"zip|postal", r"."),
    (18, None, "click Save Policy", {"click", "submit"}, r"save policy", r""),
    (19, None, "click Documents", {"click"}, r"^documents$", r""),
    (21, None, "click Medical Record category", {"click"}, r"medical record", r""),
    (22, None, "choose referral PDF", {"upload"}, r"", r"\.pdf"),
    (23, None, "click Upload", {"click", "submit"}, r"^upload$", r""),
]

def gt_line(lines, step, kw):
    for n, l in enumerate(lines):
        if re.match(r"^%d\. " % step, l):
            if not kw: return l.strip()
            for l2 in lines[n + 1: n + 12]:
                if kw in l2 and l2.strip().startswith("-"): return l2.strip()
            return l.strip()
    return "(step %d not found in workflow.md)" % step

def main(a):
    wf, label = a[0], a[1]; out = a[a.index("--out") + 1] if "--out" in a else None
    steps = json.load(open(wf))["steps"]
    lines = open(GT).read().splitlines()
    used = set(); matched = []; missing = []
    for exp in EXPECTED:
        st, kw, desc, acts, lre, vre = exp
        hit = None
        for n, s in enumerate(steps):
            if n in used or s["action"] not in acts: continue
            if lre and not re.search(lre, s["field_label"], re.I): continue
            if vre and not re.search(vre, s["value"] or "", re.I): continue
            hit = n; break
        if hit is None: missing.append(exp)
        else: used.add(hit); matched.append((exp, hit))
    extra = [(n, s) for n, s in enumerate(steps) if n not in used]
    order_ok = all(matched[k][1] < matched[k + 1][1] for k in range(len(matched) - 1))
    covered = sorted({e[0] for e, _ in matched})
    R = []
    R.append("# Score: from-recording vs ground-truth/workflow.md\n")
    R.append("- Input: **%s**" % label)
    if "--note" in a: R.append("- " + a[a.index("--note") + 1])
    R.append("- workflow.json: `%s`" % os.path.abspath(wf))
    R.append("- Ground truth: `%s` (%d expected actions derived from its steps 1-23; look-only steps 10, 15, 20, 24 are not actions)" % (GT, len(EXPECTED)))
    R.append("- **Matched %d of %d expected actions (%.0f%%); missing %d; extra %d of %d produced steps.** Matched steps in ground-truth order: %s." % (
        len(matched), len(EXPECTED), 100.0 * len(matched) / len(EXPECTED), len(missing), len(extra), len(steps), "yes" if order_ok else "NO"))
    R.append("- Ground-truth steps the input covered (at least one action matched): %s" % (", ".join(map(str, covered)) or "none"))
    if covered:
        last = max(covered); inscope = [e for e in EXPECTED if e[0] <= last]
        m_in = sum(1 for e, _ in matched if e[0] <= last)
        R.append("- Within the part of the workflow the input covers (ground-truth steps 1-%d): **matched %d of %d expected actions (%.0f%%)**." % (last, m_in, len(inscope), 100.0 * m_in / len(inscope)))
    R.append("- Not capturable by the recorder by design: the native browser confirm \"Provider not available, use it anyway?\" (step 14). recorder.ts listens for DOM click/change/submit only, so the OK click on a native dialog cannot appear in events.json.\n")
    R.append("## Matched (%d)\n" % len(matched))
    R.append("| # | expected | produced step (screen / field_label / value / action) |\n|---|---|---|")
    for (st, kw, desc, *_), n in matched:
        s = steps[n]; R.append("| %d | %s | %s / %s / %s / %s |" % (st, desc, s["screen"], s["field_label"], (s["value"] or "")[:60].replace("|", "/"), s["action"]))
    R.append("\n### Ground-truth text for each matched action (verbatim from workflow.md)\n")
    seen = set()
    for (st, kw, *_), _n in matched:
        l = gt_line(lines, st, kw)
        if l not in seen: seen.add(l); R.append("    " + l)
    R.append("\n## Missing (%d)\n" % len(missing))
    for st, kw, desc, *_ in missing:
        R.append("- %s. Ground truth step %d, verbatim:\n\n      %s\n" % (desc, st, gt_line(lines, st, kw)))
    if not missing: R.append("(none)")
    R.append("\n## Extra (%d) — produced steps with no ground-truth counterpart\n" % len(extra))
    for n, s in extra:
        R.append("- step %d: %s / %s / %s / %s" % (n + 1, s["screen"], s["field_label"], (s["value"] or "")[:80], s["action"]))
    if not extra: R.append("(none)")
    txt = "\n".join(R) + "\n"
    if out: open(out, "w").write(txt)
    print(txt.split("\n## Matched")[0])

if __name__ == "__main__":
    main(sys.argv[1:])
