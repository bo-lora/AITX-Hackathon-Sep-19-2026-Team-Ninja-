# Needs Mary (demo copy: demo.openemr.io/a/openemr)

Checked 13 referrals. 10 are ready to enter; 3 need Mary before anything is created.

- referral-09.pdf (Amara HACKDEMO-Ingleside): DUPLICATE: a patient HACKDEMO-Ingleside born 1988-09-11 already exists in OpenEMR (pid 7); do not create a second chart. Decision: NEEDS_MARY.
- fixture-12-nomember.pdf (Owen HACKDEMO-Triage-NoMember): MISSING_FIELD: member ID is missing on the referral. Decision: NEEDS_MARY.
- fixture-13-malformed.pdf (Iris HACKDEMO-Triage-BadID): MALFORMED_FIELD: member ID 'AX12345' does not match Aekna's pattern ('AXX' + 7 digits). Decision: NEEDS_MARY.

Booked first because they are Urgent: referral-03.pdf, referral-06.pdf, fixture-11-urgent.pdf, referral-10.pdf.

Flag counts: {"URGENT": 4, "DUPLICATE": 1, "MISSING_FIELD": 1, "MALFORMED_FIELD": 1}
Source: triage-site-a.json, generated 2026-09-19T12:40:19-05:00
