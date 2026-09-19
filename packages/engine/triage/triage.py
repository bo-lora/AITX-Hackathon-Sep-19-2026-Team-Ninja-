#!/usr/bin/env python3
"""triage — pre-entry triage over extracted referral PDFs (deterministic, no LLM).

  triage [--dir referrals] [--extra triage/fixtures] --out triage.json [--offline] [--site main|a|b]

1. Extracts every *.pdf in --dir and --extra with ../extract/extract (read-only use).
2. Field sanity: missing / malformed fields are flagged for Mary; nothing is guessed or repaired.
3. Duplicate check: READ-ONLY search of the live OpenEMR demo Patient Finder by last name, then DOB
   compare (dupcheck.ts). Creates nothing. --offline skips it (status NOT CHECKED).
4. Sort: Urgent before Routine; clean referrals get booking slots, urgent ones first/earliest.
Writes --out (JSON) and needs-mary.md next to it.
"""
import json, os, re, subprocess, sys
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
HACK = os.path.dirname(HERE)
EXTRACT = os.path.join(HACK, "extract", "extract")
REQUIRED = ["first_name", "last_name", "dob", "sex", "phone", "insurance_carrier", "member_id", "urgency"]
LABEL = {"first_name": "first name", "last_name": "last name", "dob": "date of birth", "sex": "sex",
         "phone": "phone number", "insurance_carrier": "insurance carrier", "member_id": "member ID",
         "urgency": "urgency (Urgent/Routine)", "address_zip": "ZIP code"}
FIRST_BOOKING_DAY = date(2026, 9, 21)  # DECISIONS 11:41: weekdays only, Mon 2026-09-21 onward
SLOT_MIN, DAY_START, DAY_END = 30, 9 * 60, 16 * 60


def args(argv):
    a = {"dir": os.path.join(HACK, "referrals"), "extra": os.path.join(HERE, "fixtures"),
         "out": os.path.join(HERE, "triage.json"), "offline": False, "site": "main"}
    i = 0
    while i < len(argv):
        k = argv[i]
        if k in ("--dir", "--extra", "--out", "--site"):
            a[k[2:]] = argv[i + 1]; i += 2
        elif k == "--offline":
            a["offline"] = True; i += 1
        elif k == "--no-extra":
            a["extra"] = None; i += 1
        elif k in ("-h", "--help"):
            print(__doc__); sys.exit(0)
        else:
            sys.exit("triage: unknown argument %s" % k)
    for k in ("dir", "extra", "out"):
        if a[k]:
            a[k] = os.path.abspath(a[k])
    return a


def extract_dir(d):
    recs, errs = [], []
    for f in sorted(x for x in os.listdir(d) if x.lower().endswith(".pdf")):
        p = subprocess.run([EXTRACT, os.path.join(d, f)], capture_output=True, text=True)
        if p.returncode != 0:
            errs.append({"file": f, "source_dir": d, "error": p.stderr.strip()})
            continue
        r = json.loads(p.stdout); r["source_dir"] = d
        recs.append(r)
    return recs, errs


def shape(s):
    return re.sub(r"[0-9]", "9", re.sub(r"[A-Za-z]", "A", s))


def member_rules(recs):
    """Per carrier: the majority character shape of observed member IDs + the common letter prefix."""
    by = defaultdict(list)
    for r in recs:
        if r.get("insurance_carrier") and r.get("member_id"):
            by[r["insurance_carrier"]].append(r["member_id"].strip())
    rules = {}
    for carrier, ids in by.items():
        shp, n = Counter(shape(i) for i in ids).most_common(1)[0]
        same = [i for i in ids if shape(i) == shp]
        letters = re.match(r"A*", shp).group(0)
        prefix = os.path.commonprefix([i[:len(letters)] for i in same]) if letters else ""
        # regex: common prefix literal, remaining letters [A-Z], digits \d
        rx = "^" + re.escape(prefix) + ("[A-Z]{%d}" % (len(letters) - len(prefix)) if len(letters) > len(prefix) else "")
        digits = shp[len(letters):]
        rx += "".join("\\d" if c == "9" else "[A-Z]" for c in digits)
        rx = re.sub(r"(\\d)+", lambda m: "\\d{%d}" % (len(m.group(0)) // 2), rx) + "$"
        rules[carrier] = {"regex": rx, "observed": "%d of %d member IDs share this shape" % (n, len(ids)),
                          "plain": "%s + %d digits" % (("'%s'" % prefix) if prefix else "%d letters" % len(letters), len(digits))
                          if set(digits) == {"9"} else shp}
    return rules


def sanity(r, rules):
    flags = []
    for f in REQUIRED:
        if not str(r.get(f, "")).strip():
            flags.append({"type": "MISSING_FIELD", "field": f,
                          "reason": "%s is missing on the referral" % LABEL[f]})
    dob = r.get("dob", "")
    if dob:
        try:
            d = datetime.strptime(dob, "%Y-%m-%d").date()
            if d > date.today() or d.year < 1900:
                flags.append({"type": "MALFORMED_FIELD", "field": "dob", "value": r.get("display_dob") or dob,
                              "reason": "date of birth %s is not a plausible birth date" % (r.get("display_dob") or dob)})
        except ValueError:
            flags.append({"type": "MALFORMED_FIELD", "field": "dob", "value": r.get("display_dob") or dob,
                          "reason": "date of birth '%s' is not a real date" % (r.get("display_dob") or dob)})
    ph = r.get("phone", "")
    if ph and not re.fullmatch(r"\d{3}-\d{3}-\d{4}", ph):
        flags.append({"type": "MALFORMED_FIELD", "field": "phone", "value": r.get("display_phone") or ph,
                      "reason": "phone '%s' is not a 10-digit number" % (r.get("display_phone") or ph)})
    mid, car = r.get("member_id", "").strip(), r.get("insurance_carrier", "")
    if mid and car in rules and not re.fullmatch(rules[car]["regex"][1:-1], mid):
        flags.append({"type": "MALFORMED_FIELD", "field": "member_id", "value": mid,
                      "reason": "member ID '%s' does not match %s's pattern (%s)" % (mid, car, rules[car]["plain"])})
    if car and car not in rules and mid:
        flags.append({"type": "MALFORMED_FIELD", "field": "insurance_carrier", "value": car,
                      "reason": "carrier '%s' has no other referrals to learn a member-ID pattern from; check it" % car})
    u = r.get("urgency", "")
    if u and u not in ("Urgent", "Routine"):
        flags.append({"type": "MALFORMED_FIELD", "field": "urgency", "value": u,
                      "reason": "urgency '%s' is neither Urgent nor Routine" % u})
    return flags


def dupcheck(items, site):
    env = dict(os.environ, PLAYWRIGHT_BROWSERS_PATH="0", OPENEMR_SITE=site)
    p = subprocess.run([os.path.join(HERE, "node_modules", ".bin", "tsx"), os.path.join(HERE, "dupcheck.ts")],
                       input=json.dumps(items), capture_output=True, text=True, env=env, timeout=600)
    try:
        return json.loads(p.stdout), p.returncode
    except Exception:
        return [{"error": (p.stdout + p.stderr).strip()[-800:]}], p.returncode or 1


def slots():
    d = FIRST_BOOKING_DAY
    while True:
        if d.weekday() < 5:
            m = DAY_START
            while m < DAY_END:
                yield "%s %02d:%02d" % (d.isoformat(), m // 60, m % 60)
                m += SLOT_MIN
        d += timedelta(days=1)


def main():
    a = args(sys.argv[1:])
    recs, errs = extract_dir(a["dir"])
    if a["extra"] and os.path.isdir(a["extra"]):
        r2, e2 = extract_dir(a["extra"]); recs += r2; errs += e2
    rules = member_rules(recs)

    dup = {}
    dup_meta = {"mode": "offline (NOT CHECKED)" if a["offline"] else "live read-only Patient Finder search", "site": a["site"]}
    if not a["offline"]:
        items = [{"file": r["file"], "last_name": r["last_name"], "dob": r["dob"]} for r in recs if r.get("last_name")]
        # positive control: a stock demo patient that must come back FOUND, proving the FOUND path works
        items.append({"file": "_control_", "last_name": "Belford", "dob": "1972-02-09"})
        res, rc = dupcheck(items, a["site"])
        for x in res:
            if "error" in x:
                dup_meta["error"] = x["error"]
            elif x["file"] == "_control_":
                dup_meta["control"] = {"search": "Belford / 1972-02-09 (stock demo patient Phil Belford)",
                                       "status": x["status"], "pids": [m["pid"] for m in x["exact_matches"]],
                                       "searched_at": x["searched_at"]}
            else:
                dup[x["file"]] = x
        dup_meta["control_passed"] = dup_meta.get("control", {}).get("status") == "FOUND"

    out = []
    for r in recs:
        flags = sanity(r, rules)
        d = dup.get(r["file"])
        dc = {"status": "NOT CHECKED"}
        if d:
            dc = {k: d[k] for k in ("status", "searched_at", "search_url", "table_info", "exact_matches", "variant_matches",
                                     "same_last_name_other_dob")}
            if d["status"] == "FOUND":
                flags.append({"type": "DUPLICATE", "reason": "a patient %s born %s already exists in OpenEMR (pid %s); do not create a second chart"
                              % (r["last_name"], r["dob"], ", ".join(m["pid"] for m in d["exact_matches"]))})
            elif d["status"] == "POSSIBLE":
                flags.append({"type": "POSSIBLE_DUPLICATE", "reason": "same DOB %s under a variant last name (%s)"
                              % (r["dob"], "; ".join("pid %s %s" % (m["pid"], m["name"]) for m in d["variant_matches"]))})
        urgent = r.get("urgency") == "Urgent"
        blocking = [f for f in flags if f["type"] in ("DUPLICATE", "MISSING_FIELD", "MALFORMED_FIELD")]
        out.append({"file": r["file"], "source_dir": os.path.relpath(r["source_dir"], HACK),
                    "patient": "%s %s" % (r.get("first_name", ""), r.get("last_name", "")), "dob": r.get("dob", ""),
                    "urgency": r.get("urgency", ""), "urgent_flag": urgent,
                    "decision": "NEEDS_MARY" if blocking else "READY",
                    "flags": ([{"type": "URGENT", "reason": "Urgent referral: booked first, earliest slot"}] if urgent else []) + flags,
                    "duplicate_check": dc, "extracted": {k: v for k, v in r.items() if k != "source_dir"}})

    # sort: Urgent first, then referral date, then file; clean ones get booking order + slot
    out.sort(key=lambda x: (0 if x["urgent_flag"] else 1, x["extracted"].get("referral_date") or "9999", x["file"]))
    g = slots(); n = 0
    for x in out:
        if x["decision"] == "READY":
            n += 1; x["booking_order"] = n; x["suggested_slot"] = next(g)
        else:
            x["booking_order"] = None; x["suggested_slot"] = None

    counts = Counter(f["type"] for x in out for f in x["flags"])
    doc = {"generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
           "inputs": {"dir": os.path.relpath(a["dir"], HACK), "extra": a["extra"] and os.path.relpath(a["extra"], HACK)},
           "extract_errors": errs,
           "member_id_rules": rules,
           "member_id_rule_method": "per carrier, the majority character shape of the member IDs seen in this batch (letters->A, digits->9) plus the letter prefix shared by all of them; an ID that does not match is flagged, never corrected",
           "duplicate_check": dup_meta,
           "flag_counts": dict(counts),
           "every_flag_type_fired": {t: counts.get(t, 0) > 0 for t in ("URGENT", "DUPLICATE", "POSSIBLE_DUPLICATE", "MISSING_FIELD", "MALFORMED_FIELD")},
           "note_referral_01": "referral-01 (Rosa HACKDEMO-Alvarez, DOB 1985-03-14) will come back as a DUPLICATE if Aurora's recording already created Rosa HACKDEMO-Alvarez on the demo; that is the live example to show. Test-runner copies named HACKDEMO-Alvarez-TR<time> show up as POSSIBLE_DUPLICATE.",
           "referrals": out}
    with open(a["out"], "w") as fh:
        json.dump(doc, fh, indent=2); fh.write("\n")

    n_hold = sum(x["decision"] == "NEEDS_MARY" for x in out)
    lines = ["# Needs Mary", "",
             "Checked %d referrals at %s. %d are ready to enter; %d %s Mary before anything is created." % (
                 len(out), doc["generated_at"][11:16], sum(x["decision"] == "READY" for x in out), n_hold, "needs" if n_hold == 1 else "need"), ""]
    for x in out:
        if x["decision"] == "NEEDS_MARY":
            why = "; ".join(f["reason"] for f in x["flags"] if f["type"] not in ("URGENT", "POSSIBLE_DUPLICATE"))
            tag = "URGENT, " if x["urgent_flag"] else ""
            lines.append("- %s (%s%s): %s. Held, not entered." % (x["file"], tag, x["patient"].strip(), why[0].upper() + why[1:]))
    poss = [x for x in out if any(f["type"] == "POSSIBLE_DUPLICATE" for f in x["flags"])]
    if poss:
        n_p = sum(len(x["duplicate_check"]["variant_matches"]) for x in poss)
        lines += ["", "Possible duplicates (not held): %d of %d referrals match an existing chart with the same date of birth whose last name is the referral last name plus a suffix, such as %s (%d charts in total, pids in triage.json). These look like earlier test-run copies; check them before creating the patient." % (
            len(poss), len(out), poss[0]["duplicate_check"]["variant_matches"][0]["name"].split(",")[0], n_p)]
    urg = [x for x in out if x["urgent_flag"] and x["decision"] == "READY"]
    if urg:
        lines += ["", "Booked first because they are Urgent: " + ", ".join("%s (%s)" % (x["file"], x["suggested_slot"]) for x in urg) + "."]
    if not a["offline"] and not dup_meta.get("control_passed"):
        lines += ["", "WARNING: the duplicate check could not be trusted this run (%s)." % dup_meta.get("error", "control search did not come back FOUND")]
    with open(os.path.join(os.path.dirname(a["out"]), "needs-mary.md"), "w") as fh:
        fh.write("\n".join(lines) + "\n")
    print("wrote %s and needs-mary.md  flags=%s" % (a["out"], dict(counts)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
