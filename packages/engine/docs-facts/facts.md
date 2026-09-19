# OpenEMR docs: cited facts for Mary's demo

Collected 2026-09-19. Every quote was checked by script against a saved copy of its page in `sources/` (see `build.py`). ★ marks the three facts recommended for the screen.

## ★ F1-required-fields

**Fact:** On a default OpenEMR install, a new patient needs only three required fields: Name, Sex and date of birth; required fields are shown with red labels.

**Quote:** "In the default OpenEMR instance, those are: Name, Sex, DOB."

**Source (official):** https://www.open-emr.org/wiki/index.php/OpenEMR_7_Search_-_Add_Patient

**Doc version:** OpenEMR 7 (page title 'OpenEMR 7 Search - Add Patient')

**Why it matters for Mary's demo:** Mary's automation only has to fill three fields to register a patient; a clinic can mark more as required, so the script should check for red labels rather than assume three.

## F2-new-search-only-way

**Fact:** The Patient > New/Search screen is the only way to add a new patient by hand in OpenEMR.

**Quote:** "OpenEMR's 'New/ Search' function isn't much of a search tool but it is the only way to manually add new patients to the system."

**Source (official):** https://www.open-emr.org/wiki/index.php/OpenEMR_7_Search_-_Add_Patient

**Doc version:** OpenEMR 7 (page title 'OpenEMR 7 Search - Add Patient')

**Why it matters for Mary's demo:** Registering a patient in the UI always goes through this one screen, so the generated commands have a single fixed entry point.

## F3-duplicate-check

**Fact:** When the Create New Patient button is clicked, OpenEMR's new-patient form can open a duplicate-checker dialog, built from the demographic fields that are flagged for duplicate checking.

**Quote:** "// Build and invoke the URL to create the dup-checker dialog."

**Source (official):** https://github.com/openemr/openemr/blob/master/interface/new/new_comprehensive.php

**Doc version:** openemr master branch source code (fetched 2026-09-19); not a user guide. Which fields are checked depends on layout settings.

**Why it matters for Mary's demo:** Automation has to expect a possible 'matching patients' popup after Create and handle it. HACKDEMO- names make a real match unlikely, but a re-run with the same name can trigger it. The popup was NOT observed on the live demo (UNVERIFIED).

## ★ F4-appointment-from-calendar

**Fact:** A receptionist books an appointment from the Calendar by clicking the provider's name, clicking a time slot to open the appointment dialog, choosing the visit category, searching for and selecting the patient, then clicking Save.

**Quote:** "3. Click on the time in the date column to open the appointment scheduler dialog"

**Source (official):** https://www.open-emr.org/wiki/index.php/A_Generic_Medical_Encounter_Workflow_in_OpenEMR_6.1

**Doc version:** OpenEMR 6.1 (older than the 8.4.0 demo). The v7 calendar notes link to this page as the current write-up of the steps.

**Why it matters for Mary's demo:** This is step 2 of Mary's workflow, and the official steps are the same click path the generated commands will follow.

## F5-appointment-category

**Fact:** Each appointment has a Category (the type of appointment). The category list can be customized, and most categories are tied to billing and reports.

**Quote:** "1. Category - what type of appointment this is. Categories are customizable; see below. Most of them also interact with other aspects of the EMR, such as billing, reports, etc."

**Source (official):** https://www.open-emr.org/wiki/index.php/TheCalendarNotes-v7

**Doc version:** OpenEMR v7.0.1 (stated on page)

**Why it matters for Mary's demo:** The follow-up booking has to choose a category. Category names vary by clinic, so the script should pick the category by its visible label, not by its position in the list.

## F6-appointment-status-side-effects

**Fact:** Appointment statuses (for example Arrived) are a customizable list. Some statuses trigger other actions, such as a check-in status creating an encounter form when that setting is turned on.

**Quote:** "Be careful when editing these because in addition to the list's use to select indicators of the progression of an encounter, many of the individual statuses interact with EMR code to trigger other events."

**Source (official):** https://www.open-emr.org/wiki/index.php/TheCalendarNotes-v7

**Doc version:** OpenEMR v7.0.1 (stated on page)

**Why it matters for Mary's demo:** When booking a future follow-up, the automation should leave the status at its default. Setting a check-in status like Arrived could create side effects on a shared demo.

## F7-find-available-needs-schedule

**Fact:** The appointment dialog's Find Available button only works if the provider's calendar has In Office and Out of Office times set up. Otherwise OpenEMR shows a popup saying the provider is not available.

**Quote:** "NOTE: if the provider's calendar is not configured at least with 'In/ Out of Office' times you will see popup saying that the provider is not available at this time (etc)'"

**Source (official):** https://www.open-emr.org/wiki/index.php/TheCalendarNotes-v7

**Doc version:** OpenEMR v7.0.1 (stated on page)

**Why it matters for Mary's demo:** A likely failure point for automation. Clicking a time slot directly is safer than depending on Find Available. Whether the demo providers have schedules set up is UNVERIFIED.

## ★ F8-api-must-be-enabled

**Fact:** OpenEMR has REST and FHIR APIs, but an administrator has to turn them on under Administration > Config > Connectors, and apps must register for OAuth2 access.

**Quote:** "Enable OpenEMR Standard REST API"

**Source (official):** https://github.com/openemr/openemr/blob/master/API_README.md

**Doc version:** openemr master branch README (fetched 2026-09-19). Lists FHIR R4, US Core 8.0, SMART on FHIR v2.2.0.

**Why it matters for Mary's demo:** This is the contrast for the pitch: the API exists but is off by default and needs admin setup plus OAuth2 app registration. Mary's front desk usually can't get that, but her browser already works.

## Notes

- F4 comes from an OpenEMR 6.1 page, which is older than the 8.4.0 demo. The v7.0.1 calendar notes link to it for the appointment steps. If an on-screen fact must be v7 or newer, use F7 instead.
- F8's quote is the checkbox label. The heading above it reads "1. Enable the API", and the menu path above the checkbox reads "Administration → Config → Connectors" (both in sources/API_README.md).
- Every source is official (open-emr.org wiki or the openemr GitHub repo). No forum posts were used.
