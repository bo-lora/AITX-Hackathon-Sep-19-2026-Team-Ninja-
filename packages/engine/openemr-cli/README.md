# openemr: referral fax intake CLI for Mary's AI

For each referral PDF, `openemr intake` reads the PDF with the extractor (`../extract/extract`), then on OpenEMR creates the patient (demographics + contact), adds primary insurance, attaches the PDF to the patient's Documents (Medical Record) and books a New Patient appointment on the next weekday at 10:00. After every write it loads the page again and reads the saved values back. The exit code tells you whether each read-back matched.

Target: the public OpenEMR demo, https://demo.openemr.io/a/openemr (the clean backup instance, the default; OpenEMR 8.4.0). It refuses any last name that does not start with `HACKDEMO-`.

## Install (this laptop)

```
cd <repo>/auth-broker && npm install && PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium chromium-headless-shell
export PATH="<repo>/openemr-cli:$PATH"
openemr --help
```

`openemr-cli/node_modules` is a symlink to `../auth-broker/node_modules` (Playwright + tsx), and the `openemr` wrapper sets `PLAYWRIGHT_BROWSERS_PATH=0`. It also needs `/usr/bin/python3` for the extractor. No npm package is published.

## Session (Mary logs in herself)

- `openemr login` runs `../auth-broker/auth login`. A visible browser window opens, Mary logs in, and the session is saved to `$AUTH_SESSION_FILE` (default `<repo>/automation-server/sessions/openemr.json`).
- No command ever takes a password argument.
- Documents require a user who can open patient Documents. On the demo that is `admin` (the receptionist sees "Documents Not Authorized").
- How the session is reused: OpenEMR's `main.php?<redacted> link works only once, so a saved session cannot reopen the normal tabbed UI. The CLI loads each OpenEMR page on its own, headless, with the saved cookies. `shim.js` adds empty stand-ins for the helpers those pages expect from `main.php`: `restoreSession`, `left_nav`, `jsGlobals.assetVersion`, `oeFormatters`. Without the shim, the insurance screen stays on "Loading...".

## Commands

```
openemr login
openemr check
openemr intake <referral.pdf> [--suffix TAG] [--date YYYY-MM-DD] [--time HH:MM] [--dry-run] [--json]
openemr extract <referral.pdf>
openemr patient create --first F --last HACKDEMO-X --dob YYYY-MM-DD --sex Male|Female [--phone P --street S --city C --state TX --zip Z] [--suffix TAG] [--dry-run]
openemr insurance add --last HACKDEMO-X --carrier Aekna --member-id ID [--group G] [--first F --dob D --sex S --street S --city C --state TX --zip Z] [--pid N] [--dry-run]
openemr doc attach --last HACKDEMO-X --file referral.pdf [--pid N] [--dry-run]
openemr appt create --last HACKDEMO-X [--date next-weekday|YYYY-MM-DD] [--time 10:00] [--category "New Patient"] [--pid N] [--dry-run]
```

Common options: `--json` prints only the final JSON line. `--site a|main|b` picks the demo instance (default `a` = https://demo.openemr.io/a/openemr; `main` = https://demo.openemr.io/openemr; `b` = https://demo.openemr.io/b/openemr). `--shots DIR` saves a screenshot at the end (or on failure). `--suffix TAG` adds `-TAG` to the last name, so the same PDF can be run again without making a duplicate.

- `check`: prints `LOGGED_IN` (exit 0) or `LOGGED_OUT` (exit 2). It calls `auth-broker check` against the Patient Finder.
- `intake --dry-run` extracts the PDF and prints the plan. It opens no browser and writes nothing. The single-step commands support `--dry-run` too.
- `patient create` stops without writing if a patient with that last name already exists (exit 3).
- The single-step commands find the patient by exact last name in the Patient Finder. They need exactly one match, or you pass `--pid`. Before acting they also check that the chart shows that last name.

## Output and exit codes

Progress lines come first (`[12.3s] ...`), each write marked "save only, NOT a verification" and each read-back marked "VERIFIED". The last line is a JSON summary: `ok`, `exit_code`, `pid`, `steps[]` (each with `status` and `readback` values), `extractor`, `dialogs` (every JS dialog the CLI accepted) and `error`/`mismatch` when something fails.

| code | meaning |
|---|---|
| 0 | every write was read back on a fresh page load and matched |
| 1 | a read-back mismatch; `mismatch` has the step, field, expected value and actual value |
| 2 | logged out or no session file: run `openemr login` |
| 3 | any other error (site validation error verbatim, duplicate refused, bad arguments) |

## What each read-back checks (fresh `page.goto`, never the page the write left behind)

- patient: the Patient Finder must list exactly one patient with that last name. On `demographics_full.php`, first, last, DOB, sex, phone, street, city, state and zip must match (ignoring case, because OpenEMR stores street and city in upper case).
- insurance: on `insurance_edit.php`, the carrier starts with the expected name, member ID and group match exactly, and Effective Date End is empty.
- document: the patient's Documents list contains `<pdf name>.pdf`.
- appointment: the dashboard's Future Appointments list has an entry with the date, the time and the category (New Patient).

## Recipes copied from earlier work (not imported)

From `../openemr-smoke/extras.js` + `NOTES.md` and `../test-runner/oe-session.ts`:
- Insurance: set Relationship = Self first through the select2 widget. Type text fields with real keypresses, then Tab. Hide the date picker after each field. Pick Sex, State, Country and Provider by clicking the widget options. Clear Effective Date End before saving.
- Documents go under the Medical Record category.
- Accept the "Provider not available, use it anyway?" popup.
- Patient create calls `srcConfirmSave()`, the function behind the duplicate-check popup's Confirm Create button. The popup itself is flaky.

## Evidence

`evidence/final/` (run1, run2, login and check logs, negative controls) and `evidence/dev*/` (development runs). `test/` holds test-only helpers. `test/test-login-headless.ts` logs in with the public demo credentials and is never used by the product path.
