#!/usr/bin/env python3
"""Generate 3 triage fixture PDFs in triage/fixtures/ using the EXISTING letterhead template
from ../referrals/generate.py (imported read-only; that file is not modified, no bytecode written).

  fixture-11-urgent.pdf    HACKDEMO-Triage-Urgent    Urgent, all fields valid
  fixture-12-nomember.pdf  HACKDEMO-Triage-NoMember  Routine, Member # left blank
  fixture-13-malformed.pdf HACKDEMO-Triage-BadID     Routine, Member # "AX12345" (breaks AXX+7 digits)

Run: ../referrals/.venv/bin/python make_fixtures.py
"""
import os, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "referrals"))
import generate as G  # noqa: E402
from reportlab.lib.pagesizes import letter  # noqa: E402
from reportlab.pdfgen import canvas  # noqa: E402

clinic = G.CLINICS[0]
base = dict(template="letterhead", faxed_look=False,
            clinic_name=clinic["name"],
            clinic_address="%s, %s, %s %s" % (clinic["street"], clinic["city"], clinic["state"], clinic["zip"]),
            clinic_phone=clinic["phone"], clinic_fax=clinic["fax"],
            referring_provider=clinic["provider"], referring_npi=clinic["npi"],
            address_state="TX", insurance_carrier="Aekna", group_number="GRP-40404",
            display_referral_date="September 18, 2026", referral_date="2026-09-18")
FIX = [
    dict(base, file="fixture-11-urgent.pdf", first_name="Nora", last_name="HACKDEMO-Triage-Urgent",
         dob="1977-05-22", display_dob="05/22/1977", sex="Female", display_sex="Female",
         phone="512-555-0191", display_phone="512-555-0191",
         address_street="18 Fictional Mesa Dr", address_city="Austin", address_zip="78745",
         member_id="AXX4417290", specialty="Cardiology", urgency="Urgent",
         reason="Chest tightness with exertion over the past week; please see as soon as possible."),
    dict(base, file="fixture-12-nomember.pdf", first_name="Owen", last_name="HACKDEMO-Triage-NoMember",
         dob="1992-10-08", display_dob="10/08/1992", sex="Male", display_sex="Male",
         phone="512-555-0192", display_phone="512-555-0192",
         address_street="702 Imaginary Pine St", address_city="Austin", address_zip="78704",
         member_id="", specialty="Dermatology", urgency="Routine",
         reason="Changing mole on upper back; skin check requested."),
    dict(base, file="fixture-13-malformed.pdf", first_name="Iris", last_name="HACKDEMO-Triage-BadID",
         dob="1983-02-14", display_dob="02/14/1983", sex="Female", display_sex="Female",
         phone="512-555-0193", display_phone="512-555-0193",
         address_street="31 Makebelieve Cedar Ct", address_city="Austin", address_zip="78751",
         member_id="AX12345", specialty="Endocrinology", urgency="Routine",
         reason="Follow-up of abnormal thyroid labs; endocrine consult requested."),
]
out = os.path.join(HERE, "fixtures")
os.makedirs(out, exist_ok=True)
for i, r in enumerate(FIX):
    c = canvas.Canvas(os.path.join(out, r["file"]), pagesize=letter, invariant=1)
    c.setTitle("Referral - %s" % r["last_name"])
    G.draw_letterhead(c, r, 5000 + i)
    c.save()
    print("wrote", r["file"])
