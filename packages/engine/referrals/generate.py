#!/usr/bin/env python3
"""Generate 10 synthetic referral-fax PDFs + referrals.json answer key.

All data is fictional. Carriers come from ../ground-truth/insurance-carriers.txt
(the OpenEMR demo insurance dropdown), minus any name on REAL_INSURERS; if that
file is missing/FREE TEXT/UNAVAILABLE, fictional fallback carriers are used.

Run:  CARRIERS_ONLY=Aekna .venv/bin/python generate.py && .venv/bin/python verify.py   (current demo build: Aekna only)
"""
import json
import os
import random
from datetime import date

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

HERE = os.path.dirname(os.path.abspath(__file__))
CARRIERS_FILE = os.path.join(HERE, "..", "ground-truth", "insurance-carriers.txt")
FALLBACK_CARRIERS = ["Lone Star Health Plan", "Bluebonnet Mutual", "Hill Country Care"]
# Names present in the demo dropdown that are real insurers -> excluded (rule: no real insurers)
REAL_INSURERS = {"blue cross blue shield"}

W, H = letter


def load_carriers():
    """Return (carriers, source_note)."""
    if os.environ.get("CARRIERS_ONLY"):  # e.g. CARRIERS_ONLY=Aekna  (comma-separated override)
        names = [n.strip() for n in os.environ["CARRIERS_ONLY"].split(",") if n.strip()]
        return names, "CARRIERS_ONLY override: %s (Aekna is the only carrier on all 3 demo instances)" % names
    if not os.path.exists(CARRIERS_FILE):
        return FALLBACK_CARRIERS, "FALLBACK: carriers file absent"
    raw = open(CARRIERS_FILE).read().strip()
    if not raw or raw.upper().startswith(("FREE TEXT", "UNAVAILABLE")):
        return FALLBACK_CARRIERS, "FALLBACK: carriers file says " + (raw.splitlines()[0] if raw else "EMPTY")
    names, excluded = [], []
    for line in raw.splitlines():
        line = line.strip()
        if line.startswith("#"):
            break  # notes sections (e.g. "## If a carrier disappears") follow the carrier list
        if not line:
            continue
        # dropdown lines look like "Aekna (4345 Donkey Road, , FL, 44433)" -> name before " ("
        name = line.split(" (")[0].strip()
        if name.lower() in REAL_INSURERS:
            excluded.append(name)
        else:
            names.append(name)
    if not names:
        return FALLBACK_CARRIERS, "FALLBACK: no usable carriers in file (excluded real: %s)" % excluded
    return names, "ground-truth/insurance-carriers.txt (excluded as real insurers: %s)" % (excluded or "none")


CLINICS = [
    dict(name="Pecan Grove Family Medicine", street="4410 Fictional Oak Blvd, Suite 200",
         city="Austin", state="TX", zip="78745", phone="512-555-0142", fax="512-555-0143",
         provider="Dr. Marisol Quintero, MD", npi="9123456780"),
    dict(name="Barton Ridge Primary Care", street="1807 Imaginary Creek Rd",
         city="Austin", state="TX", zip="78704", phone="512-555-0150", fax="512-555-0151",
         provider="Dr. Owen Whitcombe, DO", npi="9234567801"),
    dict(name="Cedar Hollow Community Clinic", street="92 Makebelieve Ln, Bldg C",
         city="Round Rock", state="TX", zip="78664", phone="512-555-0160", fax="512-555-0161",
         provider="Priya Ramanathan, FNP-C", npi="9345678012"),
]

# (first, surname, dob, sex, street, city, zip, reason, specialty, urgency)
PATIENTS = [
    ("Rosa", "Alvarez", date(1985, 3, 14), "Female", "2210 Willowbend Dr", "Austin", "78745",
     "Evaluation of chronic right knee pain not improved with physical therapy.", "Orthopedics", "Routine"),
    ("Marcus", "Bellweather", date(1972, 11, 2), "Male", "508 Sagebrush Trl", "Austin", "78704",
     "Follow-up of elevated blood pressure readings over the past three months.", "Cardiology", "Routine"),
    ("Linh", "Cartwright", date(1990, 6, 27), "Female", "1319 Mockingbird Ln", "Pflugerville", "78660",
     "Recurring migraines with increasing frequency; neurology consult requested.", "Neurology", "Urgent"),
    ("Daniel", "Okonkwo", date(1964, 1, 9), "Male", "77 Riverstone Ct", "Round Rock", "78664",
     "Screening colonoscopy; patient has family history of colon polyps.", "Gastroenterology", "Routine"),
    ("Hannah", "Duvall", date(2001, 8, 18), "Female", "4402 Live Oak St", "Austin", "78751",
     "Persistent rash on both forearms for six weeks, no response to OTC cream.", "Dermatology", "Routine"),
    ("Tomas", "Escobedo", date(1958, 4, 30), "Male", "9021 Prairie Wind Dr", "Cedar Park", "78613",
     "Shortness of breath on exertion; please evaluate for possible asthma or COPD.", "Pulmonology", "Urgent"),
    ("Grace", "Fairbanks", date(1979, 12, 5), "Female", "615 Bluestem Ave", "Austin", "78723",
     "Thyroid nodule found on routine exam; ultrasound and endocrine review requested.", "Endocrinology", "Routine"),
    ("Kenji", "Harrowgate", date(1995, 2, 21), "Male", "3308 Canyon View Rd", "Georgetown", "78626",
     "Left shoulder pain after lifting injury, limited range of motion.", "Orthopedics", "Routine"),
    ("Amara", "Ingleside", date(1988, 9, 11), "Female", "1127 Pecan Hollow Dr", "Austin", "78748",
     "Ongoing low mood and poor sleep; behavioral health intake requested.", "Behavioral Health", "Routine"),
    ("Wesley", "Jaramillo", date(1969, 7, 3), "Male", "240 Starlight Loop", "Kyle", "78640",
     "Numbness and tingling in both feet; evaluate for peripheral neuropathy.", "Neurology", "Urgent"),
]

TEMPLATES = ["letterhead", "form", "faxcover"]
FAXED = {"referral-03.pdf", "referral-08.pdf"}  # get gray speckle + slight rotation (text stays real text)


def build_records(carriers):
    rng = random.Random(20260919)
    recs = []
    for i, (first, sur, dob, sex, street, city, zipc, reason, spec, urg) in enumerate(PATIENTS):
        n = i + 1
        clinic = CLINICS[i % len(CLINICS)]
        tmpl = TEMPLATES[i % len(TEMPLATES)]
        rdate = date(2026, 9, 1 + i * 2)
        phone = "512-555-01%02d" % (10 + n)
        carrier = carriers[i % len(carriers)]
        member = "%s%07d" % ("".join(w[0] for w in carrier.split()).upper()[:3].ljust(3, "X"), rng.randint(1000000, 9999999))
        group = "GRP-%05d" % rng.randint(10000, 99999)
        r = dict(
            file="referral-%02d.pdf" % n, template=tmpl, faxed_look=("referral-%02d.pdf" % n) in FAXED,
            clinic_name=clinic["name"], clinic_address="%s, %s, %s %s" % (clinic["street"], clinic["city"], clinic["state"], clinic["zip"]),
            clinic_phone=clinic["phone"], clinic_fax=clinic["fax"],
            referring_provider=clinic["provider"], referring_npi=clinic["npi"],
            referral_date=rdate.isoformat(),
            first_name=first, last_name="HACKDEMO-" + sur,
            dob=dob.isoformat(), sex=sex, phone=phone,
            address_street=street, address_city=city, address_state="TX", address_zip=zipc,
            insurance_carrier=carrier, member_id=member, group_number=group,
            reason=reason, specialty=spec, urgency=urg,
        )
        # printed formats differ per template -> display_* keys hold exactly what is printed
        if tmpl == "letterhead":
            r["display_dob"] = dob.strftime("%m/%d/%Y")
            r["display_referral_date"] = rdate.strftime("%B %-d, %Y")
            r["display_sex"] = sex
            r["display_phone"] = phone
        elif tmpl == "form":
            r["display_dob"] = dob.strftime("%m/%d/%Y")
            r["display_referral_date"] = rdate.strftime("%m/%d/%Y")
            r["display_sex"] = sex[0]
            r["display_phone"] = "(%s) %s" % (phone[:3], phone[4:])
        else:
            r["display_dob"] = dob.strftime("%m-%d-%Y")
            r["display_referral_date"] = rdate.strftime("%m/%d/%Y")
            r["display_sex"] = sex
            r["display_phone"] = phone
        recs.append(r)
    return recs


# ---------------------------------------------------------------- drawing helpers
def fax_noise(c, seed):
    rng = random.Random(seed)
    c.saveState()
    for _ in range(1400):
        g = rng.uniform(0.55, 0.85)
        c.setFillColorRGB(g, g, g)
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        c.circle(x, y, rng.uniform(0.2, 0.7), stroke=0, fill=1)
    for _ in range(3):  # faint horizontal fax streaks
        y = rng.uniform(0, H)
        c.setStrokeColorRGB(0.85, 0.85, 0.85)
        c.setLineWidth(rng.uniform(0.3, 1.0))
        c.line(0, y, W, y)
    c.restoreState()


def fax_header(c, r, page, pages):
    c.setFont("Courier", 8)
    c.drawString(0.4 * inch, H - 0.3 * inch,
                 "%s  FROM: %s  FAX %s   P.%d/%d" % (r["display_referral_date"], r["clinic_name"].upper(), r["clinic_fax"], page, pages))


def start_page(c, r, seed, page, pages):
    if r["faxed_look"]:
        fax_noise(c, seed)
        c.translate(W / 2, H / 2)
        c.rotate(0.7)
        c.translate(-W / 2, -H / 2)
        c.setFillColorRGB(0.12, 0.12, 0.12)
        fax_header(c, r, page, pages)


def wrap(c, text, x, y, width, font="Helvetica", size=10.5, lead=14):
    c.setFont(font, size)
    for line in simpleSplit(text, font, size, width):
        c.drawString(x, y, line)
        y -= lead
    return y


def signature(c, r, x, y):
    c.setFont("Helvetica-Oblique", 16)
    c.drawString(x, y + 4, r["referring_provider"].split(",")[0].replace("Dr. ", ""))
    c.line(x, y, x + 3 * inch, y)
    c.setFont("Helvetica", 9)
    c.drawString(x, y - 12, "Signature: %s   NPI %s" % (r["referring_provider"], r["referring_npi"]))


# ---------------------------------------------------------------- template 1: letterhead letter
def draw_letterhead(c, r, seed):
    start_page(c, r, seed, 1, 1)
    c.setFillColorRGB(0.1, 0.25, 0.45)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(inch, H - inch, r["clinic_name"])
    c.setFont("Helvetica", 9.5)
    c.drawString(inch, H - inch - 15, r["clinic_address"])
    c.drawString(inch, H - inch - 28, "Phone %s  |  Fax %s" % (r["clinic_phone"], r["clinic_fax"]))
    c.setLineWidth(1.5)
    c.line(inch, H - inch - 36, W - inch, H - inch - 36)
    c.setFillColorRGB(0, 0, 0)
    y = H - 1.9 * inch
    c.setFont("Helvetica", 10.5)
    c.drawString(inch, y, r["display_referral_date"]); y -= 28
    c.drawString(inch, y, "To: New Patient Intake, %s" % r["specialty"]); y -= 14
    c.drawString(inch, y, "RE: Referral - %s %s  (%s)" % (r["first_name"], r["last_name"], r["urgency"])); y -= 28
    y = wrap(c, "Dear Colleague,", inch, y, W - 2 * inch); y -= 6
    y = wrap(c, "I am referring the patient below to your %s service. Reason for referral: %s"
             % (r["specialty"], r["reason"]), inch, y, W - 2 * inch); y -= 10
    c.setFont("Helvetica-Bold", 11)
    c.drawString(inch, y, "Patient Information"); y -= 16
    rows = [
        ("Patient Name", "%s %s" % (r["first_name"], r["last_name"])),
        ("Date of Birth", r["display_dob"]),
        ("Sex", r["display_sex"]),
        ("Phone", r["display_phone"]),
        ("Address", r["address_street"]),
        ("City/State/ZIP", "%s, %s %s" % (r["address_city"], r["address_state"], r["address_zip"])),
        ("Insurance", r["insurance_carrier"]),
        ("Member #", r["member_id"]),
        ("Group #", r["group_number"]),
        ("Priority", r["urgency"]),
    ]
    for k, v in rows:
        c.setFont("Helvetica-Bold", 10); c.drawString(1.2 * inch, y, k + ":")
        c.setFont("Helvetica", 10); c.drawString(2.6 * inch, y, v)
        y -= 14
    y -= 10
    y = wrap(c, "Please contact the patient to schedule a new-patient appointment. Relevant notes are "
             "available on request. Thank you for seeing this patient.", inch, y, W - 2 * inch)
    y -= 16
    c.setFont("Helvetica", 10.5); c.drawString(inch, y, "Sincerely,"); y -= 40
    signature(c, r, inch, y)
    c.showPage()


# ---------------------------------------------------------------- template 2: boxed form
def box(c, x, y, w, h, label, value, fs=10.5):
    c.rect(x, y - h, w, h)
    c.setFont("Helvetica", 7); c.drawString(x + 3, y - 9, label.upper())
    c.setFont("Courier-Bold", fs); c.drawString(x + 5, y - h + 6, value)


def draw_form(c, r, seed):
    start_page(c, r, seed, 1, 1)
    c.setFont("Helvetica-Bold", 15)
    c.drawCentredString(W / 2, H - 0.85 * inch, "OUTPATIENT REFERRAL FORM")
    c.setFont("Helvetica", 9)
    c.drawCentredString(W / 2, H - 0.85 * inch - 14, "%s  -  %s" % (r["clinic_name"], r["clinic_address"]))
    c.drawCentredString(W / 2, H - 0.85 * inch - 26, "Tel %s   Fax %s" % (r["clinic_phone"], r["clinic_fax"]))
    x0, full = 0.75 * inch, W - 1.5 * inch
    half, third = full / 2, full / 3
    bh = 28
    y = H - 1.55 * inch
    box(c, x0, y, half, bh, "Referral Date", r["display_referral_date"])
    box(c, x0 + half, y, half, bh, "Urgency", r["urgency"]); y -= bh + 10
    c.setFont("Helvetica-Bold", 10); c.drawString(x0, y, "SECTION A - PATIENT"); y -= 4
    box(c, x0, y, half, bh, "Last Name", r["last_name"])
    box(c, x0 + half, y, half, bh, "First Name", r["first_name"]); y -= bh
    box(c, x0, y, third, bh, "DOB", r["display_dob"])
    box(c, x0 + third, y, third, bh, "Sex (M/F)", r["display_sex"])
    box(c, x0 + 2 * third, y, third, bh, "Home Phone", r["display_phone"]); y -= bh
    box(c, x0, y, full, bh, "Street Address", r["address_street"]); y -= bh
    box(c, x0, y, half, bh, "City", r["address_city"])
    box(c, x0 + half, y, half / 2, bh, "State", r["address_state"])
    box(c, x0 + half * 1.5, y, half / 2, bh, "ZIP", r["address_zip"]); y -= bh + 10
    c.setFont("Helvetica-Bold", 10); c.drawString(x0, y, "SECTION B - INSURANCE"); y -= 4
    box(c, x0, y, full, bh, "Primary Carrier", r["insurance_carrier"]); y -= bh
    box(c, x0, y, half, bh, "Subscriber ID", r["member_id"])
    box(c, x0 + half, y, half, bh, "Group No.", r["group_number"]); y -= bh + 10
    c.setFont("Helvetica-Bold", 10); c.drawString(x0, y, "SECTION C - REFERRAL"); y -= 4
    box(c, x0, y, full, bh, "Specialty Requested", r["specialty"]); y -= bh
    c.rect(x0, y - 50, full, 50)
    c.setFont("Helvetica", 7); c.drawString(x0 + 3, y - 9, "REASON FOR REFERRAL / DIAGNOSIS")
    wrap(c, r["reason"], x0 + 5, y - 22, full - 10, font="Courier-Bold", size=10, lead=12)
    y -= 50 + 10
    c.setFont("Helvetica-Bold", 10); c.drawString(x0, y, "SECTION D - REFERRING PROVIDER"); y -= 4
    box(c, x0, y, half, bh, "Provider", r["referring_provider"])
    box(c, x0 + half, y, half, bh, "NPI", r["referring_npi"]); y -= bh + 40
    signature(c, r, x0, y)
    c.showPage()


# ---------------------------------------------------------------- template 3: fax cover + referral page
def draw_faxcover(c, r, seed):
    start_page(c, r, seed, 1, 2)
    c.setFont("Helvetica-Bold", 40)
    c.drawString(inch, H - 1.5 * inch, "FAX")
    c.setFont("Helvetica", 10)
    c.drawString(inch, H - 1.5 * inch - 20, r["clinic_name"])
    c.drawString(inch, H - 1.5 * inch - 33, r["clinic_address"])
    y = H - 2.8 * inch
    for k, v in [("To:", "New Patient Scheduling"), ("From:", r["referring_provider"]),
                 ("Date:", r["display_referral_date"]), ("Pages:", "2 (including cover)"),
                 ("Sender Phone:", r["clinic_phone"]), ("Sender Fax:", r["clinic_fax"]),
                 ("Re:", "%s referral - %s" % (r["urgency"], r["last_name"]))]:
        c.setFont("Helvetica-Bold", 12); c.drawString(inch, y, k)
        c.setFont("Helvetica", 12); c.drawString(2.5 * inch, y, v)
        c.line(2.5 * inch, y - 4, W - inch, y - 4)
        y -= 26
    y -= 20
    wrap(c, "CONFIDENTIALITY NOTICE: This facsimile contains confidential information intended only for "
         "the recipient named above. If you received this in error, please call the sender and destroy "
         "all copies. (Synthetic demo document - all data fictional.)", inch, y, W - 2 * inch, size=8.5, lead=11)
    c.showPage()

    start_page(c, r, seed + 1, 2, 2)
    y = H - 1.0 * inch
    c.setFont("Helvetica-Bold", 14); c.drawString(inch, y, "Referral Request - %s" % r["specialty"]); y -= 26
    lines = [
        ("Subscriber ID", r["member_id"]),
        ("Plan / Carrier", r["insurance_carrier"]),
        ("Group Number", r["group_number"]),
        None,
        ("Patient Last Name", r["last_name"]),
        ("Patient First Name", r["first_name"]),
        ("Date of Birth", r["display_dob"]),
        ("Gender", r["display_sex"]),
        ("Contact Phone", r["display_phone"]),
        ("Address", r["address_street"]),
        ("City", r["address_city"]),
        ("State", r["address_state"]),
        ("Zip Code", r["address_zip"]),
        None,
        ("Specialty", r["specialty"]),
        ("Urgency", r["urgency"]),
    ]
    for item in lines:
        if item is None:
            y -= 8; continue
        c.setFont("Helvetica", 10.5); c.drawString(inch, y, item[0] + ":")
        c.setFont("Helvetica-Bold", 10.5); c.drawString(2.7 * inch, y, item[1])
        y -= 15
    y -= 6
    c.setFont("Helvetica", 10.5); c.drawString(inch, y, "Reason:"); y -= 15
    y = wrap(c, r["reason"], 1.2 * inch, y, W - 2.4 * inch, font="Helvetica-Bold"); y -= 10
    c.setFont("Helvetica", 10.5)
    c.drawString(inch, y, "Referring Clinic: %s" % r["clinic_name"]); y -= 50
    signature(c, r, inch, y)
    c.showPage()


DRAW = {"letterhead": draw_letterhead, "form": draw_form, "faxcover": draw_faxcover}


def main():
    carriers, source = load_carriers()
    recs = build_records(carriers)
    for i, r in enumerate(recs):
        path = os.path.join(HERE, r["file"])
        c = canvas.Canvas(path, pagesize=letter, invariant=1)
        c.setTitle("Referral - %s" % r["last_name"])
        c.setAuthor(r["clinic_name"] + " (synthetic)")
        DRAW[r["template"]](c, r, 1000 + i * 7)
        c.save()
    with open(os.path.join(HERE, "referrals.json"), "w") as f:
        json.dump(recs, f, indent=2)
    print("carriers used:", carriers)
    print("carrier source:", source)
    print("wrote %d PDFs + referrals.json" % len(recs))


if __name__ == "__main__":
    main()
