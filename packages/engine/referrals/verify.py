#!/usr/bin/env python3
"""Round-trip check: every printed value in referrals.json must appear in its PDF's extracted text.

Two independent extractors (pdftotext CLI and pypdf). Whitespace is collapsed (wrapped lines -> spaces).
Where the PDF prints a different format, the display_<field> key is checked instead of <field>.
Negative control: another record's last name / member ID must NOT be found (proves the check can fail).
"""
import json
import os
import re
import subprocess
import sys

from pypdf import PdfReader

HERE = os.path.dirname(os.path.abspath(__file__))
PRINTED = ["clinic_name", "clinic_address", "clinic_phone", "clinic_fax", "referring_provider", "referring_npi",
           "referral_date", "first_name", "last_name", "dob", "sex", "phone", "address_street", "address_city",
           "address_state", "address_zip", "insurance_carrier", "member_id", "group_number", "reason",
           "specialty", "urgency"]


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def extract(path):
    out = {}
    p = subprocess.run(["pdftotext", "-layout", path, "-"], capture_output=True, text=True)
    out["pdftotext"] = norm(p.stdout) if p.returncode == 0 else None
    out["pypdf"] = norm(" ".join(pg.extract_text() or "" for pg in PdfReader(path).pages))
    return out


def main():
    recs = json.load(open(os.path.join(HERE, "referrals.json")))
    assert len(recs) == 10, len(recs)
    assert len({r["last_name"] for r in recs}) == 10 and all(r["last_name"].startswith("HACKDEMO-") for r in recs)
    all_ok = True
    for idx, r in enumerate(recs):
        texts = extract(os.path.join(HERE, r["file"]))
        misses, checked = [], 0
        for fld in PRINTED:
            key = "display_" + fld if ("display_" + fld) in r else fld
            val = norm(str(r[key]))
            checked += 1
            for tool, t in texts.items():
                if t is None or len(t) < 200:
                    misses.append("%s: %s extraction failed/too short" % (key, tool))
                elif val not in t:
                    misses.append("%s=%r not found by %s" % (key, val, tool))
        # negative control
        other = recs[(idx + 1) % len(recs)]
        neg_fail = [v for v in (other["last_name"], other["member_id"]) if any(v in t for t in texts.values() if t)]
        status = "PASS" if not misses and not neg_fail else "FAIL"
        all_ok &= status == "PASS"
        chars = {k: (len(v) if v else 0) for k, v in texts.items()}
        print("%s  %s  [%s%s]  %d fields x 2 extractors, text chars %s, neg-control %s"
              % (r["file"], status, r["template"], ", faxed-look" if r["faxed_look"] else "", checked, chars,
                 "OK" if not neg_fail else "LEAKED %s" % neg_fail))
        for m in misses:
            print("    MISS:", m)
    print("ALL PASS" if all_ok else "SOME FAILURES")
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
