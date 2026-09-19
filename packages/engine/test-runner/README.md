# test-runner

This folder runs a generated workflow (`commands.json`) against a live browser tool, checks every step by reading the result back, times each step, and writes the test report the demo shows.

- **Confirmed ✓**: the step's `command` exited 0, and then its `verify` command also exited 0. The verify command has to re-read the record on a fresh page load. A save message never counts.
- **Hypothesis ?**: anything else. The reason is written on the step: the command failed (the site's error text is quoted), there was no verify, the verify failed, or the step was skipped because it depends on a step that failed.

The target is OpenEMR on the public demo (https://demo.openemr.io/openemr, admin/pass). Only `HACKDEMO-` records are touched: `oe-session.ts` refuses any last name without that prefix.

## Run it

```
cd <repo>/test-runner
npm install                      # playwright 1.63.0, tsx, typescript (already done)
npx tsx run.ts commands.example.json          # single patient + appointment
npx tsx make-commands.ts --limit 10           # builds commands.referrals.json (values from the answer key)
npx tsx make-commands.ts --source ../extract/extracted.json --out commands.referrals.json   # values from the PDF extractor
npx tsx run.ts commands.referrals.json        # batch of referrals
```

Output goes to `runs/<YYYY-MM-DD_HHMMSS>/`:
- `report.json`
- `report.html`
- `shots/*.png`
- `commands.json`: a copy of the input

The last two lines the runner prints are the headline (`Mary: 40m 00s · AI: 10m 29s | steps ✓ 35/41 | items ✓ 5/10`) and the path to `report.html`.

Flags for `run.ts`:
- `--site main|a|b`: which demo instance (default: taken from `target_url`, otherwise `main`)
- `--out <dir>`: parent folder for runs (default `runs`)
- `--rerender <runDir>`: rebuild `report.html` from an existing `report.json`. It does not touch the site.

Flags for `make-commands.ts`:
- `--limit N`: how many referrals to include (default 10)
- `--only referral-03.pdf,...`: include only these files
- `--source <json>`: the values to type in. Default is `../referrals/referrals.json`, the answer key.
- `--key <json>`: the answer key used for scoring only (default `../referrals/referrals.json`)
- `--manual-seconds S`: Mary's time for one referral. Without this flag it stays 240 and is labelled PLACEHOLDER.
- `--out <file>`: output file (default `commands.referrals.json`)

## How steps talk to the browser

Every step is a plain shell command. `run.ts` starts one headless Playwright browser (`oe-session.ts`) and serves it on a local port. It sets `OE_PORT` for each step, and `npx tsx oe.ts <action> --key value ...` sends the action to that port. We could not use a separate browser per step: OpenEMR's `main.php?<redacted> token works only once, and a session restored into a new browser loaded a blank page when tested at 11:45 CDT.

The runner takes the before and after screenshots itself, around each command, plus a `verify` screenshot after the read-back.

`oe.ts` actions:
- `login --user admin --pass pass` / `verify-login`
- `create-patient --lname HACKDEMO-… --fname --dob YYYY-MM-DD --sex Female|Male [--phone --street --city --st TX --zip]`
- `verify-patient --lname … [--fname --dob --phone --street --city --zip]`: runs the finder search, then checks the dashboard (name, DOB), then reads the contact fields from a fresh load of `demographics_full.php`. OpenEMR stores street and city in UPPERCASE, so that comparison ignores case.
- `add-insurance --lname … --carrier Aekna --member-id … --group … [--fname --dob --sex --street --city --st --zip]` / `verify-insurance --lname … --carrier --member-id --group`. The verify does a fresh load of `insurance_edit.php` and checks provider, policy number and group number, that the end date is empty, and whether the dashboard contains the member ID.
- `upload-doc --lname … --file <pdf>` / `verify-doc --lname … --file <pdf>`: uploads to category "Medical Record" (parent_id 3). The verify does a fresh load of the Documents list.
- `book-appt --lname … --date next-weekday|tomorrow|today+N|YYYY-MM-DD --time HH:MM [--category 'New Patient']` / `verify-appt …`: the verify checks the patient dashboard's Future Appointments.

`oe-session.ts` also has these guards:
- It refuses to act if the page does not show the expected patient.
- It removes any leftover OpenEMR modals before each step.
- It accepts JS dialogs and logs them verbatim, e.g. "Provider not available, use it anyway?".

## commands.json format

```json
{
  "workflow": "text shown as the report title",
  "target_url": "https://demo.openemr.io/openemr",
  "manual_seconds": 240,
  "manual_seconds_placeholder": true,
  "vars": {"ANY": "value"},
  "setup": [ {"id": "login", "bullet": "…", "command": "<shell>", "verify": "<shell>"} ],
  "steps": [ {"id": "s1", "bullet": "…", "command": "<shell>", "verify": "<shell, exit 0 = verified>", "depends_on": ["s0"]} ],
  "items": [
    {"id": "r01", "label": "referral-01.pdf: Rosa HACKDEMO-…", "vars": {"LNAME": "…", "PDF": "/abs/path.pdf"},
     "extraction_check": {"source": "extracted.json", "matched": 12, "total": 12, "mismatches": []},
     "steps": [ {"id": "patient", …}, {"id": "insurance", "depends_on": ["patient"], …} ]}
  ]
}
```

- Use either `steps` (a single run, treated as one item) or `items` (a batch). `setup` runs once, before the items.
- `manual_seconds` is Mary's time for ONE item. The batch figure is `manual_seconds × number of items`. While `manual_seconds_placeholder` is true, the report labels it PLACEHOLDER.
- `{{NAME}}` in `command`, `verify`, `bullet` and `label` is replaced from the item's `vars`, then the top-level `vars`, then the built-ins: `HHMMSS` (the run's start time) and `ITEM` (the item id).
- `depends_on`: if a dependency's command did not exit 0, this step is skipped and recorded as `skipped: depends on <id>`. Other steps keep running.
- `extraction_check` is optional. It is written by `make-commands.ts --source`, and the report shows it as an "Extraction" row for the item.

## report.json

It holds:
- `workflow`, `target_url`, `commands_file`, `started_at`, `finished_at`
- `setup[]`, and `items[]`. Each item has `id`, `label`, `status`, `confirmed`, `total`, `ai_seconds`, `wall_seconds`, `extraction_check` and `steps[]`.
- `totals`: `items`, `items_confirmed`, `steps`, `steps_confirmed`, `steps_hypothesis`, `ai_seconds` (the sum of the steps), `ai_wall_clock_seconds`, `manual_seconds_per_item`, `manual_seconds`, `manual_seconds_placeholder`, `saving_seconds`, and `headline`.

Each step has:
- `id`, `bullet`, `command`, `verify`, `status`, `reason`
- timings: `seconds` (command + verify), `command_seconds`, `verify_seconds`
- exit codes: `exit_code`, `verify_exit_code`
- screenshots: `before_png`, `after_png`, `verify_png`. These are paths relative to the run folder.
- output tails: `stdout_tail`, `stderr_tail`, `verify_stdout_tail`, `verify_stderr_tail`
- `error_text`: verbatim stderr from the failing command or verify

## Embedding report.html in the front end

`report.html` is one self-contained page. The CSS is inline and there is no JS. Images use relative paths (`shots/…png`), so serve or copy the whole run folder, not only the HTML file.

To embed it:
- iframe it: `<iframe src="/runs/<stamp>/report.html">`, with the run folder served as static files, or
- fetch it and inject the `<body>` contents, rewriting `shots/` to the folder's URL.

At the top is a three-box stopwatch: Mary by hand, AI wall clock, and how many steps were checked by read-back. Below that is one collapsible row per referral. Rows with any "?" open automatically and list the failing step's reason in the summary line.
