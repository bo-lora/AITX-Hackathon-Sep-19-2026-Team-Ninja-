# Score: from-recording vs ground-truth/workflow.md

- Input: **SAMPLE (hand-made samples/SAMPLE-events.json, not a recording)**
- No referral-workflow human recording has been scored yet.
- workflow.json: `<repo>/from-recording/samples/SAMPLE-workflow.json`
- Ground truth: `<repo>/ground-truth/workflow.md` (33 expected actions derived from its steps 1-23; look-only steps 10, 15, 20, 24 are not actions)
- **Matched 33 of 33 expected actions (100%); missing 0; extra 0 of 33 produced steps.** Matched steps in ground-truth order: yes.
- Ground-truth steps the input covered (at least one action matched): 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23
- Within the part of the workflow the input covers (ground-truth steps 1-23): **matched 33 of 33 expected actions (100%)**.
- Not capturable by the recorder by design: the native browser confirm "Provider not available, use it anyway?" (step 14). recorder.ts listens for DOM click/change/submit only, so the OK click on a native dialog cannot appear in events.json.

## Matched (33)

| # | expected | produced step (screen / field_label / value / action) |
|---|---|---|
| 1 | open login page | Login /  / https://demo.openemr.io/openemr/interface/login/login.php?<r / open |
| 2 | Username = admin | Login / Username / admin / type |
| 2 | Password (hidden) | Login / Password / [hidden] / type |
| 2 | click Login | Login / Login /  / click |
| 3 | open Patient menu | Main menu / Patient /  / click |
| 4 | click New/Search | Main menu / New/Search /  / click |
| 5 | First Name | Search or Add Patient / First Name / Maria / type |
| 5 | Last Name | Search or Add Patient / Last Name / HACKDEMO-SAMPLE-0001 / type |
| 6 | DOB | Search or Add Patient / DOB / 1985-04-12 / type |
| 7 | Birth Sex | Search or Add Patient / Birth Sex / Female / select |
| 8 | click Create New Patient | Search or Add Patient / Create New Patient /  / click |
| 9 | click Confirm Create New Patient | Duplicate check popup / Confirm Create New Patient /  / click |
| 11 | Appointments + icon | Patient Dashboard / icon that opens Appointment dialog (unlabeled a a:has-text("")) /  / click |
| 12 | Category = New Patient | Appointment dialog / Category / New Patient / select |
| 13 | Date | Appointment dialog / Date / 2026-09-21 / type |
| 14 | Time hour | Appointment dialog / Time (hour) / 10 / type |
| 14 | Time minute | Appointment dialog / Time (minute) / 00 / type |
| 14 | click Save (appointment) | Appointment dialog / Save /  / click |
| 16 | Insurance pencil icon | Patient Dashboard / icon that opens Insurance Edit (unlabeled a a.edit-insurance) /  / click |
| 17 | Relationship = Self | Insurance Edit / Relationship / Self / select |
| 17 | Provider (carrier) | Insurance Edit / Provider / Blue Cross Blue Shield (, , , ) / select |
| 17 | Effective Date | Insurance Edit / Effective Date / 2026-09-01 / type |
| 17 | Policy Number | Insurance Edit / Policy Number / HD123456789 / type |
| 17 | Group Number | Insurance Edit / Group Number / 55501 / type |
| 17 | Subscriber Address | Insurance Edit / Subscriber Address / 100 Congress Ave / type |
| 17 | City | Insurance Edit / City / Austin / type |
| 17 | State | Insurance Edit / State / Texas / select |
| 17 | Zip Code | Insurance Edit / Zip Code / 78701 / type |
| 18 | click Save Policy | Insurance Edit / Save Policy /  / click |
| 19 | click Documents | Patient Dashboard / Documents /  / click |
| 21 | click Medical Record category | Documents / Medical Record /  / click |
| 22 | choose referral PDF | Documents / Source File Path / sample-referral.pdf / upload |
| 23 | click Upload | Documents / Upload /  / click |

### Ground-truth text for each matched action (verbatim from workflow.md)

    1. Open the login page. Screen shows "Username", "Password", "Language" and a **Login** button. (step-01)
    2. Username = `admin`, Password = `pass`, click **Login**. You land on the **Calendar** tab. (step-02)
    3. Top menu: open **Patient** (it drops down). (step-03: the open dropdown did not show up in the headless screenshot)
    4. Click **New/Search**. A tab called **Search or Add Patient** opens, with the section **Who** expanded. (step-04)
    5. Row **Name:** (red = required): **First Name** = `Maria`, **Last Name** = `HACKDEMO-GT-112243`. (step-05)
    6. **DOB:** (red) = `1985-04-12` (typed as YYYY-MM-DD; a date picker pops open). (step-06)
    7. **Birth Sex:** (red) = `Female`. (step-07)
    8. Scroll to the bottom and click **Create New Patient**. (step-08)
    9. A popup opens: a duplicate check showing "No matches were found." Click **Confirm Create New Patient**. (step-09)
    11. On the Dashboard, in the **Appointments** card (lower right), click the **+** icon. An appointment dialog opens with **Patient:** already set to "HACKDEMO-GT-112243, Maria". (step-11)
    12. **Category:** = `New Patient`. It defaults to **No Show**, so you MUST change it. **Title:** fills in "New Patient" and **duration** changes to 30 by itself. Options offered: No Show, Office Visit, Established Patient, New Patient, Health and Behavioral Assessment, Preventive Care Services, Ophthalmological Services. "New Patient" exists, so that is what was used. (step-12)
    13. **Date:** = `2026-09-21` (Monday). (step-13)
    14. **Time**: hour = `10`, minute = `00`. **Provider:** = `Lee, Donna` (the default; the other options are Smith, Billy and Stone, Fred). **Facility:** = Great Clinic (the default). Click **Save**. (step-14)
    16. On the Dashboard, click the pencil icon on the **Insurance** card. The **Insurance Edit** tab opens ("Edit Current Insurance", tabs **Primary / Secondary / Tertiary**, **Save Policy** button). (step-16)
    - **Relationship:** = `Self` FIRST. This fills **Subscriber** (Maria / HACKDEMO-GT-112243), **D.O.B.** and **Sex** from the patient record. The fields show "Loading..." for about a second. Anything typed into those fields before choosing Self is overwritten.
    - **Provider** (this is the insurance company) = `Blue Cross Blue Shield (, , , )`. Options are listed in insurance-carriers.txt.
    - **Effective Date** (red) = `2026-09-01`
    - **Policy Number** (red) = `HD123456789` (the member ID)
    - **Group Number** = `55501`
    - **Subscriber Address** (red) = `100 Congress Ave`, **City** (red) = `Austin`, **State** (red) = `Texas`, **Zip Code** (red) = `78701`. These stay blank after Self because the patient has no address.
    18. Click **Save Policy**. A green message says **"Policy saved successfully."** and **Selected Policy** changes to "2026-09-01 - Current". (step-18)
    19. Return to the patient (**Back to Patient** button, or the Dashboard tab). In the patient's nav row (Dashboard, History, Assessments, Report, **Documents**, Transactions, Issues, Ledger, External Data), click **Documents**. (step-19) Receptionist does not have this link.
    21. In the tree, click the category **Medical Record**. The right side changes to "Upload Document to category 'Medical Record'". The demo has no "Referral" category. The tree shows: Advance Directive, CCD, CCDA, CCR, Eye Module, FHIR Export Document, Invoices, Lab Report, Medical Record, Onsite Portal, Patient Information. (step-21)
    22. Under **Source File Path:**, click the first **Choose Files** and pick the referral PDF. (step-22)
    23. Click **Upload**. The page shows **Uploaded** / "Name: sample-referral.pdf". (step-23)

## Missing (0)

(none)

## Extra (0) — produced steps with no ground-truth counterpart

(none)
