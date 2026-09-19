# automation-server

A local HTTP server that the team's web app calls. It wraps the tools built earlier today:
- auth-broker: the login pop-up and the saved session.
- recorder.ts: live capture of Mary's clicks and typing.
- test-runner: runs the OpenEMR steps and writes the report.

It runs on the demo laptop, because the login and recording windows need a screen.

## Start

```
<repo>/automation-server/start
```

**Demo site: https://demo.openemr.io/a/openemr (instance "a", the clean instance; decision 12:35 CDT).** Every endpoint uses it by default: `/login`, `/status`, `/record`, `/run` and `/intake`. `/run` and `/intake` accept `site: 'main' | 'a' | 'b'` to override. To change the default for the whole server, start it with `OE_SITE=main` (or `b`).

It listens on http://localhost:4710. Port 4700 is taken by another local service. For demo use, start it with a clean environment. Do not set `AUTH_LOGIN_HOOK`, `REC_DRIVER` or `TEST_LOGIN_*`. Those are test-only, and Mary types her own login.

To keep it running in the background, with the log going to server.log:

```
cd <repo>/automation-server && nohup ./start >> server.log 2>&1 &
```

## Endpoints
- All responses are JSON.
- CORS is open (`*`).
- Only one browser job runs at a time: `/login`, `/record`, `/run` or `/intake`. A second job gets HTTP 409 `{error, busy, retry}`. To wait, poll `GET /health` until `busy` is `null`.
- Each site has its own saved login: `sessions/openemr-<site>.json`. `/login`, `/status`, `/record` and `/intake` all use the login for the site you ask for, and default to a. A Main login is not valid on /a.

### Front-end integration

```js
const API = 'http://localhost:4710';

// GET /health: is the server up, and is a browser job running?
const health = await (await fetch(`${API}/health`)).json();
// → { ok: true, site: 'https://demo.openemr.io/a/openemr', default_site: 'a', sites, busy: null | 'login' | 'record' | 'run' | 'intake', endpoints: [...] }

// GET /status: is the saved OpenEMR session still valid? Checked headlessly, takes about 5-10 s.
const { status } = await (await fetch(`${API}/status?site=a`)).json();   // → { status: 'LOGGED_IN'|'LOGGED_OUT', site, site_url, session_file }

// POST /login: opens a headed login window on the laptop. Mary logs in herself.
// The request stays open until she finishes (up to 5 min).
const login = await fetch(`${API}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ site: 'a' }) });
// 200 → { status: 'LOGGED_IN', site }   400 → { status: 'LOGGED_OUT', error }   409 → busy

// POST /record: opens a headed browser at OpenEMR. Every click, field change and submit is captured,
// in every iframe, with a screenshot per click. Passwords are recorded as "[hidden]".
// The request returns when Mary CLOSES the window.
// NOTE: the saved session does NOT carry over into a new browser window. OpenEMR's main.php link works only once;
// this was seen at 12:26 CDT, when main.php sent the window to login_screen.php?error=1. So Mary logs in INSIDE
// the recorder window, and her login becomes the first events of the recording (password stored as "[hidden]").
const rec = await (await fetch(`${API}/record`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: 'https://demo.openemr.io/openemr/interface/main/tabs/main.php' }), // url is optional
})).json();
// → { id, events_url, start_url, started_at, duration_seconds, events: [
//      { i, t, kind: 'click'|'fill'|'submit'|'navigate'|'note', tag, type, selector, label, text, value?,
//        frame_url, frame_title, screenshot? } ] }
// Screenshot URL for one event: `${API}/recordings/${rec.id}/${event.screenshot}`

// GET /recordings/latest: events.json from the newest recording
const latestRec = await (await fetch(`${API}/recordings/latest`)).json();

// POST /run: runs a commands file through test-runner and returns the report. This takes minutes
// (about 1 min per referral). commands_file is an absolute path and is optional;
// the default is test-runner/commands.referrals-3.json. site is optional: 'main' | 'a' | 'b', default 'a'.
// The server runs a copy of the file (in run-inputs/) with target_url set to the chosen site, so the report header names the right site.
const run = await (await fetch(`${API}/run`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ commands_file: '<repo>/automation-server/commands.referral-1.json' }),
})).json();
// → { run_id, exit_code, report_url: '/runs/<id>/report.html', totals: { steps, steps_confirmed, headline, ... }, report }
window.open(`${API}${run.report_url}`);

// POST /intake: ONE-BUTTON BATCH through the openemr CLI. It uses the saved login for the site, and NO password appears in any command.
// For each PDF (Urgent first, by triage) it runs: openemr intake <pdf> --site <s> [--suffix T] --json
// (extract → patient → insurance → document → appointment, each one read back from OpenEMR).
// Referrals that triage holds (missing or malformed field, exact duplicate) are NOT entered. They show as 'Needs Mary'.
// With no valid login for the site: returns 401 {error:'login needed'}. With headed:true it opens the login window instead,
// and Mary types her own password.
// headed:true → a visible browser, slowed by 300 ms per action (slowmo to change that). This is the on-stage mode.
// Body (all fields optional): pdfs (file names or absolute paths) | dir, limit, site ('a' default | 'main' | 'b'), headed, slowmo,
// suffix (added to last names; leave it out on stage), triage (default true), triage_live (live duplicate search, about 80 s), async.
const intake = await (await fetch(`${API}/intake`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ site: 'a', headed: true, pdfs: ['referral-04.pdf', 'referral-05.pdf'] }),
})).json();
// → { intake_id, site, site_url, backend, headed, wall_seconds, summary: '2/2 confirmed · 0 need Mary', review_url,
//     referrals: [{ file, status: 'Confirmed ✓'|'Hypothesis ?'|'Needs Mary'|'Not run', reason?, seconds, extracted: {...},
//                   flags: [...], command, cli: {pid, steps:[{step,status,readback}]}, links: [{key,label,url}], pdf_url, final_shot }] }
const lastIntake = await (await fetch(`${API}/intake/latest`)).json();

// GET /review/latest: 302 to Mary's review page for the newest /intake. It has one card per referral:
// - the input PDF and the extracted fields
// - links into OpenEMR: chart, insurance (on the chart), Documents, appointment
// - the after-screenshot and expected-vs-got
// - a 'Needs Mary' section at the top
// - Looks right / Something's wrong buttons
// <iframe src="http://localhost:4710/review/latest"></iframe>
// Each button click → POST /review/<intake_id>/mark {file, verdict: 'looks_right'|'something_wrong', note?}, saved to intake/<id>/review.json
await fetch(`${API}/review/${intake.intake_id}/mark`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ file: 'referral-04.pdf', verdict: 'looks_right' }) });

// GET /report/latest: 302 redirect to the newest report.html. You can use it directly in an <iframe> or a link.
// <iframe src="http://localhost:4710/report/latest"></iframe>

// GET /report/latest.json: report.json from the newest finished run
const report = await (await fetch(`${API}/report/latest.json`)).json();

// Static files: /runs/<run_id>/report.html, /runs/<run_id>/shots/*.png, /recordings/<id>/events.json, /recordings/<id>/shots/*.png
```

Handling "busy":

```js
async function whenIdle() { while ((await (await fetch(`${API}/health`)).json()).busy) await new Promise(r => setTimeout(r, 2000)); }
```

## Tests

`test/run-tests.sh` exercises every endpoint and appends the results to `test-log.txt`. The raw responses go to `test/out/`. The server under test must be started with the test-only hooks. They auto-type the public demo login and drive the recorder window by script (`test/rec-driver.ts`):

```
cd <repo>/automation-server && AUTH_LOGIN_HOOK=$PWD/../auth-broker/test/autofill-hook.ts REC_DRIVER=$PWD/test/rec-driver.ts TEST_LOGIN_USER=admin TEST_LOGIN_PASS=pass nohup ./start >> server.log 2>&1 &
```

```
<repo>/automation-server/test/run-tests.sh
```

After testing, restart the server WITHOUT those variables. See Start above.

## Files
- `server.ts`: the HTTP server.
- `recorder.ts`: the headed recorder.
- `start`: the launcher.
- `commands.referral-1.json`: the 1-referral commands file used by the /run test.
- `run-inputs/`: the site-stamped copies of the commands files that /run executed.
- `intake/<id>/`: one folder per /intake call: extracted.json, commands.json and intake.json.
- `test/`: the test script, the recorder test driver, and the raw responses.
- `test-log.txt`: the test results.
- `review-test-log.txt`: every review-page link that was clicked, and what it opened.
- `review.ts`: builds the review page. `headed-preload.cjs` makes the openemr CLI's browser visible when headed is true.
- `sessions/`: the saved login. Treat it as a secret; it is git-ignored.
- `recordings/<id>/`: events.json and a screenshot per click.
