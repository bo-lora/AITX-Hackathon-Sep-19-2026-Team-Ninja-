#!/usr/bin/env python3
"""Offline self-test of the field-sanity rules on hand-made bad records (no PDFs, no network)."""
import sys; sys.dont_write_bytecode = True
import triage as T
rules = {"Aekna": {"regex": r"^AXX\d{7}$", "plain": "'AXX' + 7 digits"}}
base = dict(first_name="Test", last_name="HACKDEMO-X", dob="1980-01-01", sex="Male", phone="512-555-0100",
            insurance_carrier="Aekna", member_id="AXX1234567", urgency="Routine")
cases = [("clean", {}, []),
         ("dob not a date", {"dob": "13/45/1980", "display_dob": "13/45/1980"}, ["MALFORMED_FIELD:dob"]),
         ("member id wrong pattern", {"member_id": "AX12345"}, ["MALFORMED_FIELD:member_id"]),
         ("missing phone", {"phone": ""}, ["MISSING_FIELD:phone"]),
         ("bad phone", {"phone": "555-0100"}, ["MALFORMED_FIELD:phone"]),
         ("missing member id", {"member_id": ""}, ["MISSING_FIELD:member_id"])]
ok = True
for name, patch, want in cases:
    got = ["%s:%s" % (f["type"], f["field"]) for f in T.sanity(dict(base, **patch), rules)]
    res = "PASS" if got == want else "FAIL"; ok &= res == "PASS"
    print(res, name, got)
sys.exit(0 if ok else 1)
