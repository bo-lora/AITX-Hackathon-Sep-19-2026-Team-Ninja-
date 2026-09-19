# Score: from-recording vs ground-truth/workflow.md

- Input: **scripted test recording (automation-driven, not a human): <repo>/automation-server/recordings/20260919_172629/events.json — covers login + patient creation only**
- No referral-workflow human recording has been scored against ground truth yet (the one human recording, human/chrome-Mary_OpenEMR_Baseline_001, is a lookup workflow, hand-scored separately). This input came from the server agent's scripted /record test at 12:26 (automation-server/server.test.log line 48: [rec] test driver finished).
- workflow.json: `<repo>/from-recording/scripted/20260919_172629-workflow.json`
- Ground truth: `<repo>/ground-truth/workflow.md` (33 expected actions derived from its steps 1-23; look-only steps 10, 15, 20, 24 are not actions)
- **Matched 12 of 33 expected actions (36%); missing 21; extra 0 of 12 produced steps.** Matched steps in ground-truth order: yes.
- Ground-truth steps the input covered (at least one action matched): 1, 2, 3, 4, 5, 6, 7, 8, 9
- Within the part of the workflow the input covers (ground-truth steps 1-9): **matched 12 of 12 expected actions (100%)**.
- Not capturable by the recorder by design: the native browser confirm "Provider not available, use it anyway?" (step 14). recorder.ts listens for DOM click/change/submit only, so the OK click on a native dialog cannot appear in events.json.

## Matched (12)

| # | expected | produced step (screen / field_label / value / action) |
|---|---|---|
| 1 | open login page | Login /  / https://demo.openemr.io/openemr/interface/login/login.php?<r / open |
| 2 | Username = admin | Login / Username / admin / type |
| 2 | Password (hidden) | Login / Password / [hidden] / type |
| 2 | click Login | Login / Login /  / click |
| 3 | open Patient menu | Main menu / Patient /  / click |
| 4 | click New/Search | Main menu / New/Search /  / click |
| 5 | First Name | Search or Add Patient / First Name / Rec / type |
| 5 | Last Name | Search or Add Patient / Last Name / HACKDEMO-REC-122640 / type |
| 6 | DOB | Search or Add Patient / DOB / 1970-01-01 / type |
| 7 | Birth Sex | Search or Add Patient / Birth Sex / Female / select |
| 8 | click Create New Patient | Search or Add Patient / Create New Patient /  / click |
| 9 | click Confirm Create New Patient | Duplicate check popup / Confirm Create New Patient /  / click |

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

## Missing (21)

- Appointments + icon. Ground truth step 11, verbatim:

      11. On the Dashboard, in the **Appointments** card (lower right), click the **+** icon. An appointment dialog opens with **Patient:** already set to "HACKDEMO-GT-112243, Maria". (step-11)

- Category = New Patient. Ground truth step 12, verbatim:

      12. **Category:** = `New Patient`. It defaults to **No Show**, so you MUST change it. **Title:** fills in "New Patient" and **duration** changes to 30 by itself. Options offered: No Show, Office Visit, Established Patient, New Patient, Health and Behavioral Assessment, Preventive Care Services, Ophthalmological Services. "New Patient" exists, so that is what was used. (step-12)

- Date. Ground truth step 13, verbatim:

      13. **Date:** = `2026-09-21` (Monday). (step-13)

- Time hour. Ground truth step 14, verbatim:

      14. **Time**: hour = `10`, minute = `00`. **Provider:** = `Lee, Donna` (the default; the other options are Smith, Billy and Stone, Fred). **Facility:** = Great Clinic (the default). Click **Save**. (step-14)

- Time minute. Ground truth step 14, verbatim:

      14. **Time**: hour = `10`, minute = `00`. **Provider:** = `Lee, Donna` (the default; the other options are Smith, Billy and Stone, Fred). **Facility:** = Great Clinic (the default). Click **Save**. (step-14)

- click Save (appointment). Ground truth step 14, verbatim:

      14. **Time**: hour = `10`, minute = `00`. **Provider:** = `Lee, Donna` (the default; the other options are Smith, Billy and Stone, Fred). **Facility:** = Great Clinic (the default). Click **Save**. (step-14)

- Insurance pencil icon. Ground truth step 16, verbatim:

      16. On the Dashboard, click the pencil icon on the **Insurance** card. The **Insurance Edit** tab opens ("Edit Current Insurance", tabs **Primary / Secondary / Tertiary**, **Save Policy** button). (step-16)

- Relationship = Self. Ground truth step 17, verbatim:

      - **Relationship:** = `Self` FIRST. This fills **Subscriber** (Maria / HACKDEMO-GT-112243), **D.O.B.** and **Sex** from the patient record. The fields show "Loading..." for about a second. Anything typed into those fields before choosing Self is overwritten.

- Provider (carrier). Ground truth step 17, verbatim:

      - **Provider** (this is the insurance company) = `Blue Cross Blue Shield (, , , )`. Options are listed in insurance-carriers.txt.

- Effective Date. Ground truth step 17, verbatim:

      - **Effective Date** (red) = `2026-09-01`

- Policy Number. Ground truth step 17, verbatim:

      - **Policy Number** (red) = `HD123456789` (the member ID)

- Group Number. Ground truth step 17, verbatim:

      - **Group Number** = `55501`

- Subscriber Address. Ground truth step 17, verbatim:

      - **Subscriber Address** (red) = `100 Congress Ave`, **City** (red) = `Austin`, **State** (red) = `Texas`, **Zip Code** (red) = `78701`. These stay blank after Self because the patient has no address.

- City. Ground truth step 17, verbatim:

      - **Subscriber Address** (red) = `100 Congress Ave`, **City** (red) = `Austin`, **State** (red) = `Texas`, **Zip Code** (red) = `78701`. These stay blank after Self because the patient has no address.

- State. Ground truth step 17, verbatim:

      - **Subscriber Address** (red) = `100 Congress Ave`, **City** (red) = `Austin`, **State** (red) = `Texas`, **Zip Code** (red) = `78701`. These stay blank after Self because the patient has no address.

- Zip Code. Ground truth step 17, verbatim:

      - **Subscriber Address** (red) = `100 Congress Ave`, **City** (red) = `Austin`, **State** (red) = `Texas`, **Zip Code** (red) = `78701`. These stay blank after Self because the patient has no address.

- click Save Policy. Ground truth step 18, verbatim:

      18. Click **Save Policy**. A green message says **"Policy saved successfully."** and **Selected Policy** changes to "2026-09-01 - Current". (step-18)

- click Documents. Ground truth step 19, verbatim:

      19. Return to the patient (**Back to Patient** button, or the Dashboard tab). In the patient's nav row (Dashboard, History, Assessments, Report, **Documents**, Transactions, Issues, Ledger, External Data), click **Documents**. (step-19) Receptionist does not have this link.

- click Medical Record category. Ground truth step 21, verbatim:

      21. In the tree, click the category **Medical Record**. The right side changes to "Upload Document to category 'Medical Record'". The demo has no "Referral" category. The tree shows: Advance Directive, CCD, CCDA, CCR, Eye Module, FHIR Export Document, Invoices, Lab Report, Medical Record, Onsite Portal, Patient Information. (step-21)

- choose referral PDF. Ground truth step 22, verbatim:

      22. Under **Source File Path:**, click the first **Choose Files** and pick the referral PDF. (step-22)

- click Upload. Ground truth step 23, verbatim:

      23. Click **Upload**. The page shows **Uploaded** / "Name: sample-referral.pdf". (step-23)


## Extra (0) — produced steps with no ground-truth counterpart

(none)
