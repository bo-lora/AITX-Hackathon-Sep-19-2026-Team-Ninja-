# Ground-truth click path: referral intake on OpenEMR (one referral)

Walked live on 2026-09-19, 11:22-11:50 CDT, by the ground-truth agent (headless agent-browser session `hack-groundtruth`, now closed).

## 5. Instance, login, records created
- Instance: https://demo.openemr.io/openemr (login page https://demo.openemr.io/openemr/interface/login/login.php), OpenEMR 8.4.0
- Login to use in the video: **admin / pass** (per the coordinator's final decision). HOW IT WAS ACTUALLY WALKED: steps 1-18 (patient, appointment, insurance) were walked as **receptionist / receptionist**; steps 19-23 (document) as **admin / pass**, because receptionist gets "Documents Not Authorized". Admin's top menu has more items (Calendar Finder Flow Recalls Messages Patient Fees Modules Procedures Admin Reports Miscellaneous Popups) but it has the same Patient > New/Search entry. The screen and field labels in steps 4-18 are assumed identical under admin: UNVERIFIED for admin, not re-walked.
- Patient created: **Maria HACKDEMO-GT-112243**, patient ID shown as (28)
- Sample referral used: `<repo>/ground-truth/sample-referral.pdf` (1-page fake PDF, made for this walk)

## 1. Numbered steps (literal on-screen labels)

**A. Log in**
1. Open the login page. Screen shows "Username", "Password", "Language" and a **Login** button. (step-01)
2. Username = `admin`, Password = `pass`, click **Login**. You land on the **Calendar** tab. (step-02)

**B. Register the patient**
3. Top menu: open **Patient** (it drops down). (step-03: the open dropdown did not show up in the headless screenshot)
4. Click **New/Search**. A tab called **Search or Add Patient** opens, with the section **Who** expanded. (step-04)
5. Row **Name:** (red = required): **First Name** = `Maria`, **Last Name** = `HACKDEMO-GT-112243`. (step-05)
6. **DOB:** (red) = `1985-04-12` (typed as YYYY-MM-DD; a date picker pops open). (step-06)
7. **Birth Sex:** (red) = `Female`. (step-07)
8. Scroll to the bottom and click **Create New Patient**. (step-08)
9. A popup opens: a duplicate check showing "No matches were found." Click **Confirm Create New Patient**. (step-09)
10. The patient opens on the **Dashboard** tab: "Medical Record Dashboard - Maria HACKDEMO-GT-112243", header "Maria HACKDEMO-GT-112243 (28)", "DOB: 1985-04-12 Age: 41". (step-10)

**C. Book the new-patient appointment**
11. On the Dashboard, in the **Appointments** card (lower right), click the **+** icon. An appointment dialog opens with **Patient:** already set to "HACKDEMO-GT-112243, Maria". (step-11)
12. **Category:** = `New Patient`. It defaults to **No Show**, so you MUST change it. **Title:** fills in "New Patient" and **duration** changes to 30 by itself. Options offered: No Show, Office Visit, Established Patient, New Patient, Health and Behavioral Assessment, Preventive Care Services, Ophthalmological Services. "New Patient" exists, so that is what was used. (step-12)
13. **Date:** = `2026-09-21` (Monday). (step-13)
14. **Time**: hour = `10`, minute = `00`. **Provider:** = `Lee, Donna` (the default; the other options are Smith, Billy and Stone, Fred). **Facility:** = Great Clinic (the default). Click **Save**. (step-14)
    - A popup titled **Available Appointments Calendar** opens, reading "No openings were found for this period." Along with it, a browser confirm dialog asks **"Provider not available, use it anyway?"**. Click **OK**. (The confirm text comes from the page source. The headless browser dismissed the dialog automatically, so the agent sent the same form submit that OK triggers. A human seeing and clicking this dialog is UNVERIFIED.)
15. The dialog closes. Under **Appointments > Future Appointments**, the Dashboard shows "New Patient  Mon, 2026-09-21 10:00  Donna Lee". (step-15)

**D. Enter the insurance from the referral**
16. On the Dashboard, click the pencil icon on the **Insurance** card. The **Insurance Edit** tab opens ("Edit Current Insurance", tabs **Primary / Secondary / Tertiary**, **Save Policy** button). (step-16)
17. Fill these fields, **in this order**:
    - **Relationship:** = `Self` FIRST. This fills **Subscriber** (Maria / HACKDEMO-GT-112243), **D.O.B.** and **Sex** from the patient record. The fields show "Loading..." for about a second. Anything typed into those fields before choosing Self is overwritten.
    - **Provider** (this is the insurance company) = `Blue Cross Blue Shield (, , , )`. Options are listed in insurance-carriers.txt.
    - **Effective Date** (red) = `2026-09-01`
    - **Policy Number** (red) = `HD123456789` (the member ID)
    - **Group Number** = `55501`
    - **Subscriber Address** (red) = `100 Congress Ave`, **City** (red) = `Austin`, **State** (red) = `Texas`, **Zip Code** (red) = `78701`. These stay blank after Self because the patient has no address.
    - Left blank: **S.S.** (shown in red, but the save went through without it), Plan Name, Subscriber Employer, CoPay. **Accept Assignment** is already YES by default. (step-17)
18. Click **Save Policy**. A green message says **"Policy saved successfully."** and **Selected Policy** changes to "2026-09-01 - Current". (step-18)

**E. Attach the referral PDF (admin only)**
19. Return to the patient (**Back to Patient** button, or the Dashboard tab). In the patient's nav row (Dashboard, History, Assessments, Report, **Documents**, Transactions, Issues, Ledger, External Data), click **Documents**. (step-19) Receptionist does not have this link.
20. The **Documents** page opens: "Documents List" with a category tree on the left and "Document Uploader/Viewer" on the right. (step-20)
21. In the tree, click the category **Medical Record**. The right side changes to "Upload Document to category 'Medical Record'". The demo has no "Referral" category. The tree shows: Advance Directive, CCD, CCDA, CCR, Eye Module, FHIR Export Document, Invoices, Lab Report, Medical Record, Onsite Portal, Patient Information. (step-21)
22. Under **Source File Path:**, click the first **Choose Files** and pick the referral PDF. (step-22)
23. Click **Upload**. The page shows **Uploaded** / "Name: sample-referral.pdf". (step-23)

**F. Check**
24. Open the patient **Dashboard**. It shows **Primary Insurance** from 2026-09-01 (Blue Cross Blue Shield, policy HD123456789, group 55501) and **Future Appointments** New Patient Mon, 2026-09-21 10:00, Donna Lee. (step-24)

Step count: **24** (about 20 real actions; steps 10, 15, 20 and 24 are just looking at the screen).
Estimated human time: **about 3 to 3.5 minutes** for a practiced run. This is an estimate, not timed. The insurance form is the slow part (about 10 fields). Patient plus appointment alone is about 60-75 seconds.

## 2. What Mary would say her workflow is
- "When a referral fax comes in, I make the new patient in the system: name, date of birth, sex."
- "I type in their insurance from the referral: carrier, member ID, group number, and the subscriber address."
- "I attach the referral PDF to the patient's documents."
- "Then I book their first visit as a New Patient appointment with the doctor."

## 3. Expected end state (observed, read back from OpenEMR after saving)
- **Patient**: Maria HACKDEMO-GT-112243, ID (28), DOB 1985-04-12, Birth Sex Female. Find it with the top search box "Search by any demographics" (type HACKDEMO-GT-112243), or with Patient > New/Search.
- **Appointment**: category/title "New Patient", Mon 2026-09-21 10:00, 30 min, provider Donna Lee, facility Great Clinic, status "- None". Shown in the patient Dashboard under Appointments > Future Appointments, and on the Calendar for 2026-09-21 in Donna Lee's column (calendar view not opened: UNVERIFIED).
- **Insurance (Primary)**: Blue Cross Blue Shield, effective 2026-09-01 until Present, Policy Number HD123456789, Group Number 55501, subscriber Maria HACKDEMO-GT-112243 (Self), 100 Congress Ave, Austin TX 78701, D.O.B. 1985-04-12, Accepts Assignment Yes. Shown in the Dashboard > Insurance card.
- **Document**: "sample-referral.pdf" uploaded to category Medical Record. The document list page carries a tree node "2026-09-19 sample-referral.pdf-93" (doc_id 93). Visible under Documents > Medical Record.

## 4. Gotchas for the person recording
- **Use admin/pass.** Receptionist gets **"Documents Not Authorized"** and cannot attach the PDF.
- **Appointment Category defaults to "No Show".** Change it to New Patient.
- **Every provider/date gets "Provider not available, use it anyway?"**: the demo providers have no office hours set up. Click OK. The Available Appointments Calendar popup showed "No openings were found for this period." for Donna Lee on both 2026-09-20 and 2026-09-21 (7-day search window; longer windows UNVERIFIED). Book a weekday anyway (Mon 2026-09-21). Sunday behaves the same way.
- **Insurance: choose Relationship = Self BEFORE typing anything on the right side.** Choosing it reloads the subscriber fields ("Loading...") and wipes what was typed. Under automation, a first save attempt failed with "One or more fields were missing or improperly filled out. Please correct the errors and try saving again." and details "Provider - This field is required and cannot be empty. | Relationship: - This field is required and cannot be empty. | State - This field is required and cannot be empty. | Sex - This field is required and cannot be empty." That was a scripting artifact (the dropdowns are select2 widgets). A human picking from the dropdowns should not see it (UNVERIFIED by a human run).
- **Insurance carrier names are odd.** "Aekna" is misspelled and appears TWICE on the main instance (one copy deactivated). "Blue Cross Blue Shield" and "Signal" exist ONLY on the main instance, not on /a or /b, so they were probably added by other public users and could disappear before the nightly reset. See insurance-carriers.txt.
- **Create New Patient opens a duplicate-check popup.** Click "Confirm Create New Patient" or nothing is saved.
- **The DOB date picker stays open** after typing and covers part of the form. Click empty space to close it.
- **Top menus are drop-downs.** "Patient" has to be clicked/hovered before "New/Search" shows.
- **Slow loads.** Right after login the Calendar and Message Inbox tabs show "Loading..." for a few seconds.
- **Shared public demo.** Other people are active on it. It resets nightly at 08:00 UTC, so this patient disappears at 03:00 CDT tomorrow.
- **Screenshots**: taken by a headless browser that sometimes captured the screen just BEFORE a click landed. Each image shows the state around its step, but the exact frame per step is not guaranteed.

## Files
- workflow.md (this file)
- screenshots/step-01.png ... step-24.png
- insurance-carriers.txt (dropdown list, how to re-add a carrier, backup-instance check)
- sample-referral.pdf (the fake referral that was uploaded)
