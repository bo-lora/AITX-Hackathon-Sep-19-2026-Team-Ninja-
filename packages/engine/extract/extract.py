#!/usr/bin/env python3
"""Referral PDF -> JSON fields extractor (deterministic, no LLM).

Usage:
  extract <pdf>                          print JSON for one PDF to stdout
  extract --all <dir> --out extracted.json   extract every *.pdf in dir

Reads ONLY the PDF(s) it is given, via `pdftotext -layout` (poppler).
Never reads the answer key.
"""
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime

PDFTOTEXT = shutil.which("pdftotext") or "/opt/homebrew/bin/pdftotext"

KEYS = ["file", "template", "faxed_look", "clinic_name", "clinic_address", "clinic_phone",
        "clinic_fax", "referring_provider", "referring_npi", "referral_date", "first_name",
        "last_name", "dob", "sex", "phone", "address_street", "address_city", "address_state",
        "address_zip", "insurance_carrier", "member_id", "group_number", "reason", "specialty",
        "urgency", "display_dob", "display_referral_date", "display_sex", "display_phone"]

# Label synonyms across the three templates -> canonical field
LABELS = {
    "patient name": "_full_name",
    "patient last name": "last_name", "last name": "last_name",
    "patient first name": "first_name", "first name": "first_name",
    "date of birth": "dob", "dob": "dob",
    "sex": "sex", "gender": "sex", "sex (m/f)": "sex",
    "phone": "phone", "contact phone": "phone", "home phone": "phone",
    "address": "address_street", "street address": "address_street",
    "city/state/zip": "_csz", "city": "address_city", "state": "address_state",
    "zip code": "address_zip", "zip": "address_zip",
    "insurance": "insurance_carrier", "plan / carrier": "insurance_carrier",
    "primary carrier": "insurance_carrier",
    "member #": "member_id", "subscriber id": "member_id",
    "group #": "group_number", "group number": "group_number", "group no.": "group_number",
    "priority": "urgency", "urgency": "urgency",
    "specialty": "specialty", "specialty requested": "specialty",
    "date": "referral_date", "referral date": "referral_date",
    "sender phone": "clinic_phone", "sender fax": "clinic_fax",
    "referring clinic": "clinic_name",
}


class ExtractError(Exception):
    pass


def pdf_text(path):
    if not os.path.isfile(path):
        raise ExtractError(f"not a file: {path}")
    try:
        r = subprocess.run([PDFTOTEXT, "-layout", path, "-"], capture_output=True, text=True, timeout=30)
    except FileNotFoundError:
        raise ExtractError(f"pdftotext not found at {PDFTOTEXT}")
    if r.returncode != 0:
        raise ExtractError(f"pdftotext failed ({r.returncode}): {r.stderr.strip()}")
    if len(r.stdout.strip()) < 50:
        raise ExtractError("no extractable text in PDF (scanned image? unsupported)")
    return r.stdout


def norm_phone(s):
    d = re.sub(r"\D", "", s or "")
    if len(d) == 11 and d.startswith("1"):
        d = d[1:]
    return f"{d[:3]}-{d[3:6]}-{d[6:]}" if len(d) == 10 else (s or "").strip()


def norm_date(s):
    s = (s or "").strip()
    for fmt in ("%m/%d/%Y", "%m-%d-%Y", "%B %d, %Y", "%b %d, %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return s


def norm_sex(s):
    t = (s or "").strip().lower()
    if t in ("m", "male"):
        return "Male"
    if t in ("f", "female"):
        return "Female"
    return (s or "").strip()


def label_pairs(lines):
    """Collect 'Label:   value' pairs (letterhead + faxcover templates)."""
    out = {}
    for ln in lines:
        m = re.match(r"^\s*([A-Za-z][A-Za-z #/().]*?):\s+(\S.*?)\s*$", ln)
        if not m:
            continue
        lab = m.group(1).strip().lower()
        if lab in LABELS and LABELS[lab] not in out:
            out[LABELS[lab]] = m.group(2).strip()
    return out


def cols(line):
    return [c.strip() for c in re.split(r"\s{2,}", line.strip()) if c.strip()]


def next_nonblank(lines, i):
    for j in range(i + 1, len(lines)):
        if lines[j].strip():
            return j, lines[j]
    return None, ""


def find_line(lines, pat, start=0):
    rx = re.compile(pat)
    for i in range(start, len(lines)):
        if rx.search(lines[i]):
            return i
    return None


def block_after(lines, i, stop_rx):
    """Join non-blank lines after index i until a blank line or stop pattern."""
    parts = []
    for j in range(i + 1, len(lines)):
        s = lines[j].strip()
        if not s:
            if parts:
                break
            continue
        if re.search(stop_rx, s):
            break
        parts.append(s)
    return " ".join(parts)


def detect_template(text):
    if "OUTPATIENT REFERRAL FORM" in text:
        return "form"
    if re.search(r"^\s*FAX\s*$", text, re.M) and "Referral Request" in text:
        return "faxcover"
    if "Patient Information" in text:
        return "letterhead"
    return "unknown"


def signature(text, r):
    m = re.search(r"Signature:\s*(.+?)\s+NPI\s+(\d{10})", text)
    if m:
        r["referring_provider"] = m.group(1).strip()
        r["referring_npi"] = m.group(2)


def parse_letterhead(lines, text, r):
    body = [l for l in lines if l.strip() and not re.search(r"FROM:.*P\.\d+/\d+", l)]
    r["clinic_name"] = body[0].strip()
    r["clinic_address"] = body[1].strip()
    m = re.search(r"Phone\s+([\d\-() ]+?)\s*\|\s*Fax\s+([\d\-() ]+)", text)
    if m:
        r["clinic_phone"], r["clinic_fax"] = norm_phone(m.group(1)), norm_phone(m.group(2))
    m = re.search(r"^\s*([A-Z][a-z]+ \d{1,2}, \d{4})\s*$", text, re.M)
    if m:
        r["display_referral_date"] = m.group(1)
    kv = label_pairs(lines)
    kv.pop("referral_date", None)
    full = kv.pop("_full_name", "")
    if full:
        first, _, last = full.partition(" ")
        r["first_name"], r["last_name"] = first, last
    csz = kv.pop("_csz", "")
    m = re.match(r"(.+?),\s*([A-Z]{2})\s+(\d{5})", csz)
    if m:
        r["address_city"], r["address_state"], r["address_zip"] = m.groups()
    r.update(kv)
    m = re.search(r"To:\s*New Patient Intake,\s*(.+)", text)
    if m:
        r["specialty"] = m.group(1).strip()
    i = find_line(lines, r"Reason for referral:")
    if i is not None:
        first = lines[i].split("Reason for referral:", 1)[1].strip()
        rest = block_after(lines, i, r"^Patient Information")
        r["reason"] = (first + " " + rest).strip()


def parse_faxcover(lines, text, r):
    i = find_line(lines, r"^\s*FAX\s*$")
    if i is not None:
        j, ln = next_nonblank(lines, i)
        r["clinic_name"] = ln.strip()
        _, ln2 = next_nonblank(lines, j)
        r["clinic_address"] = ln2.strip()
    kv = label_pairs(lines)
    r.update(kv)
    i = find_line(lines, r"^\s*Reason:\s*$")
    if i is not None:
        r["reason"] = block_after(lines, i, r"^Referring Clinic:")
    else:
        m = re.search(r"Reason:\s+(\S.*)", text)
        if m:
            r["reason"] = m.group(1).strip()


def parse_form(lines, text, r):
    m = re.search(r"^\s*(.+?)\s+-\s+(\d+ .+?, [A-Z]{2} \d{5})\s*$", text, re.M)
    if m:
        r["clinic_name"], r["clinic_address"] = m.group(1).strip(), m.group(2).strip()
    m = re.search(r"Tel\s+([\d\-() ]+?)\s+Fax\s+([\d\-() ]+)", text)
    if m:
        r["clinic_phone"], r["clinic_fax"] = norm_phone(m.group(1)), norm_phone(m.group(2))
    # referral date + urgency: first value line after the REFERRAL DATE label
    i = find_line(lines, r"REFERRAL DATE")
    if i is not None:
        _, ln = next_nonblank(lines, i)
        c = cols(ln)
        if c:
            r["display_referral_date"] = c[0]
        if len(c) > 1:
            r["urgency"] = c[1]
    a = find_line(lines, r"SECTION A")
    b = find_line(lines, r"SECTION B")
    c_ = find_line(lines, r"SECTION C")
    d = find_line(lines, r"SECTION D")
    secA = lines[a:b] if a is not None and b is not None else lines
    # names
    i = find_line(secA, r"LAST NAME")
    if i is not None:
        _, ln = next_nonblank(secA, i)
        c = cols(ln)
        if len(c) >= 2:
            r["last_name"], r["first_name"] = c[0], c[1]
    # DOB / sex / phone: find the line carrying a date (label lines may be displaced on faxed copies)
    for ln in secA:
        m = re.search(r"\b(\d{2}/\d{2}/\d{4})\b", ln)
        if m:
            r["display_dob"] = m.group(1)
            ms = re.search(r"\s([MF])\s", ln + " ")
            if ms:
                r["display_sex"] = ms.group(1)
            mp = re.search(r"(\(\d{3}\)\s*\d{3}-\d{4}|\d{3}-\d{3}-\d{4})", ln)
            if mp:
                r["display_phone"] = mp.group(1)
            break
    i = find_line(secA, r"STREET ADDRESS")
    if i is not None:
        _, ln = next_nonblank(secA, i)
        r["address_street"] = ln.strip()
    for ln in secA:
        m = re.match(r"^\s*(\S.*?)\s{2,}([A-Z]{2})\s{2,}(\d{5})\s*$", ln)
        if m:
            r["address_city"], r["address_state"], r["address_zip"] = m.groups()
            break
    secB = lines[b:c_] if b is not None and c_ is not None else lines
    i = find_line(secB, r"PRIMARY CARRIER")
    if i is not None:
        _, ln = next_nonblank(secB, i)
        r["insurance_carrier"] = ln.strip()
    i = find_line(secB, r"SUBSCRIBER ID")
    if i is not None:
        _, ln = next_nonblank(secB, i)
        c = cols(ln)
        if c:
            r["member_id"] = c[0]
        if len(c) > 1:
            r["group_number"] = c[1]
    secC = lines[c_:d] if c_ is not None and d is not None else lines
    i = find_line(secC, r"SPECIALTY REQUESTED")
    if i is not None:
        _, ln = next_nonblank(secC, i)
        r["specialty"] = ln.strip()
    i = find_line(secC, r"REASON FOR REFERRAL")
    if i is not None:
        r["reason"] = block_after(secC, i, r"^SECTION")


def extract(path):
    text = pdf_text(path)
    lines = text.replace("\f", "\n").split("\n")
    tpl = detect_template(text)
    r = {k: "" for k in KEYS}
    r["file"] = os.path.basename(path)
    r["template"] = tpl
    r["faxed_look"] = bool(re.search(r"FROM:.*FAX.*P\.\d+/\d+", text))
    if tpl == "letterhead":
        parse_letterhead(lines, text, r)
    elif tpl == "faxcover":
        parse_faxcover(lines, text, r)
    elif tpl == "form":
        parse_form(lines, text, r)
    else:
        raise ExtractError("unrecognised referral template")
    signature(text, r)

    # display_* = as printed; canonical = normalised
    if not r["display_dob"]:
        r["display_dob"] = r["dob"]
    if not r["display_sex"]:
        r["display_sex"] = r["sex"]
    if not r["display_phone"]:
        r["display_phone"] = r["phone"]
    if not r["display_referral_date"]:
        r["display_referral_date"] = r["referral_date"]
    r["dob"] = norm_date(r["display_dob"])
    r["referral_date"] = norm_date(r["display_referral_date"])
    r["sex"] = norm_sex(r["display_sex"])
    r["phone"] = norm_phone(r["display_phone"])
    r["clinic_phone"] = norm_phone(r["clinic_phone"])
    r["clinic_fax"] = norm_phone(r["clinic_fax"])
    r["urgency"] = r["urgency"].strip().capitalize() if r["urgency"] else ""
    r["reason"] = re.sub(r"\s+", " ", r["reason"]).strip()
    return r


def main(argv):
    if len(argv) >= 2 and argv[1] == "--all":
        if len(argv) < 3:
            print("usage: extract --all <dir> [--out extracted.json]", file=sys.stderr)
            return 2
        d = argv[2]
        out = None
        if "--out" in argv:
            out = argv[argv.index("--out") + 1]
        files = sorted(f for f in os.listdir(d) if f.lower().endswith(".pdf"))
        results, rc = [], 0
        for f in files:
            try:
                results.append(extract(os.path.join(d, f)))
            except ExtractError as e:
                print(f"{f}: {e}", file=sys.stderr)
                rc = 1
        js = json.dumps(results, indent=2)
        if out:
            with open(out, "w") as fh:
                fh.write(js + "\n")
        else:
            print(js)
        return rc
    if len(argv) != 2:
        print("usage: extract <pdf> | extract --all <dir> --out extracted.json", file=sys.stderr)
        return 2
    try:
        print(json.dumps(extract(argv[1]), indent=2))
        return 0
    except ExtractError as e:
        print(f"extract: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
