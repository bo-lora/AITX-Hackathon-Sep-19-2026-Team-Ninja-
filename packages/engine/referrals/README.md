# Synthetic referral fax PDFs (demo input for REFERRAL FAX INTAKE)

10 fictional referral faxes plus an answer key. Every patient's last name starts with `HACKDEMO-` and none repeat. All phone numbers are 512-555-01xx. All NPIs start with 9. Clinics, providers and people are made up.

## Files
- `referral-01.pdf` … `referral-10.pdf`: the demo input
- `referrals.json`: the answer key, one object per PDF, holding the required keys plus `clinic_address`, `clinic_phone`, `clinic_fax`, `referring_npi`, `faxed_look` and `display_*` keys
- `generate.py`: the generator (reportlab). It rebuilds every PDF and the JSON from scratch.
- `verify.py`: the text round-trip check

## Regenerate + verify
```
cd <repo>/referrals
.venv/bin/python generate.py && .venv/bin/python verify.py
```
`.venv` has reportlab 5.0.1 and pypdf 6.19.0. The verify step also needs `pdftotext` (poppler, at /opt/homebrew/bin).

## Templates
| File | Template | Faxed look | Carrier |
|---|---|---|---|
| referral-01 | letterhead | no | Aekna |
| referral-02 | form | no | Aekna |
| referral-03 | faxcover (2 pages) | YES | Aekna |
| referral-04 | letterhead | no | Aekna |
| referral-05 | form | no | Aekna |
| referral-06 | faxcover (2 pages) | no | Aekna |
| referral-07 | letterhead | no | Aekna |
| referral-08 | form | YES | Aekna |
| referral-09 | faxcover (2 pages) | no | Aekna |
| referral-10 | letterhead | no | Aekna |

- **letterhead**: a clinic letter with a "Patient Information" block. Labels: Date of Birth, Sex, Member #, Group #, Priority. The date is printed as "September 1, 2026".
- **form**: a boxed "Outpatient Referral Form" in sections A to D. Labels: DOB, Sex (M/F) (printed as M/F), Home Phone (printed as "(512) 555-0112"), Subscriber ID, Group No.
- **faxcover**: page 1 is a FAX cover sheet and page 2 is the referral. Insurance comes first. Labels: Gender, Subscriber ID, Plan / Carrier, Zip Code. DOB is printed as MM-DD-YYYY.
- **Faxed look** (03, 08): gray speckle, faint streaks, a 0.7° rotation and a fax header line. The text is still real, extractable text, not an image.

Where a PDF prints a value in a different format from the canonical JSON value, `display_dob`, `display_referral_date`, `display_sex` and `display_phone` hold exactly what is printed. The canonical `dob`/`referral_date` are YYYY-MM-DD, `sex` is Male/Female, and `phone` is 512-555-01xx.

## Carriers
Carriers are read at runtime from `../ground-truth/insurance-carriers.txt`, which holds the OpenEMR demo insurance dropdown as written by the click-path agent. The file at 11:33 CDT contained:
```
Aekna (4345 Donkey Road, , FL, 44433)
Blue Cross Blue Shield (, , , )
Signal (000, , California, 0000)
```
The generator takes the name before " (" on each line. **Superseded 11:56: the current build uses Aekna only (see Update below).** Blue Cross Blue Shield is excluded (`REAL_INSURERS` in generate.py) because the handoff forbids real insurers. If the file is missing or says FREE TEXT/UNAVAILABLE, the generator falls back to Lone Star Health Plan, Bluebonnet Mutual and Hill Country Care.

## Round-trip check result (11:35 CDT)
All 10 PASS. For each file, verify.py checks 22 printed fields with two independent extractors (pdftotext -layout and pypdf), with whitespace collapsed. A negative control confirms that the next record's last name and member ID are NOT found in each PDF, which shows the check can actually fail. No image-only PDFs. Pages 01, 03 (p.2) and 08 were also rendered and checked by eye.

## Known gaps
- **Only 2 carriers, and they look like test data.** Aekna and Signal appear to be entries someone added to the public demo, with placeholder addresses such as "4345 Donkey Road" and "000". Whether they survive the nightly 08:00 UTC reset is UNVERIFIED. If they disappear from the dropdown, the insurance step breaks. Regenerating is one command once the carriers file is updated.
- Blue Cross Blue Shield is in the dropdown but was deliberately left out (real insurer). If the team prefers a third carrier over that rule, delete it from `REAL_INSURERS` and regenerate.
- The `display_sex` check on the form template is a presence check on a single letter ("M"/"F"), so it is weak. It was confirmed by eye on referral-08 only.
- Member IDs and group numbers are formatted arbitrarily (e.g. AXX2650168, GRP-56000). Whether OpenEMR validates their format is UNVERIFIED.

## Update 11:56 CDT
All 10 PDFs regenerated with carrier **Aekna only** (the only insurer on all 3 demo instances; Signal existed only on Main and could vanish). Rebuild command:

    CARRIERS_ONLY=Aekna .venv/bin/python generate.py && .venv/bin/python verify.py

Previous Aekna+Signal build backed up in ../referrals-backup-1154/.
