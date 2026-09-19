# auth-broker — "Mary logs in herself" + automatic session recovery

Standalone TypeScript + Playwright module. A headed login window pops up, a human logs in, and the
session (Playwright storageState: cookies + localStorage) is saved to a file. Later runs check that
session headlessly and, if it has expired, pop the login window again and retry the work once.

It never reads, logs, prints or stores the password or any form field value. Only storageState is saved
(file mode 600).

## Install

```
cd <repo>/auth-broker
npm install
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium chromium-headless-shell
```

`PLAYWRIGHT_BROWSERS_PATH=0` keeps the browser inside `node_modules/`. The `./auth` wrapper sets it for you.

## Commands

Log in (headed window; a human types the credentials; waits up to 5 minutes):

```
./auth login https://demo.openemr.io/openemr/interface/login/login.php --session sessions/openemr.json
```

Check a saved session (headless). Prints exactly `LOGGED_IN` (exit 0) or `LOGGED_OUT` (exit 1):

```
./auth check https://demo.openemr.io/openemr/interface/main/finder/dynamic_finder.php --session sessions/openemr.json
```

Run a command with auto-login and one retry. The command gets the session path in `AUTH_SESSION_FILE`:

```
./auth run --url https://demo.openemr.io/openemr/interface/main/finder/dynamic_finder.php --login-url https://demo.openemr.io/openemr/interface/login/login.php --session sessions/openemr.json -- node my-automation.js
```

If `--session` is left out, the file is `./sessions/<hostname>.json`.

Run the test suite (headed windows WILL appear; uses the public OpenEMR demo account admin):

```
./run-tests.sh
```

## How it works
- **Login is done** when, polled every 500 ms, EITHER the URL leaves the login page OR no password field is visible. After 5 minutes: prints `LOGIN_TIMEOUT`, exit 2.
- **LOGGED_OUT** means one of these: the page is a login page (URL path contains login/signin), a password field is visible, the check URL returned HTTP 401/403, or it returned HTTP 400 with an empty body. The last two are additions to the handoff's rule. They are needed because OpenEMR 8.4 returns HTTP 400 with an empty body (no redirect, no password field) for protected pages when the session is missing. We saw this happen on the demo. A missing session file also counts as LOGGED_OUT.
- **run / withAuth**: check first. If LOGGED_OUT, open the headed login, then run. If the command fails (non-zero exit / throw), check again. If LOGGED_OUT, log in again and retry ONCE. A second failure is passed through as it is. If the check says LOGGED_IN, there is NO retry and the original failure is passed through unchanged.

## OpenEMR-specific gotchas (seen on demo.openemr.io, 2026-09-19)
- **Do NOT use `interface/main/tabs/main.php` as the check URL.** Without its per-login `token_main` query param, a VALID session is sent to the login page. In our first test run this also left the session unusable afterward (not isolated further: UNVERIFIED whether main.php itself kills the session). Use `interface/main/finder/dynamic_finder.php` (Patient Finder, read-only): with a valid session it returns 200 "Patient Finder", and without one it returns 400 with an empty body.
- The check URL does not show a login form when you are logged out, so pass `--login-url .../interface/login/login.php` (or `loginUrl` in code) for the headed login.
- Headed Chrome reports that empty 400 page as `net::ERR_HTTP_RESPONSE_CODE_FAILURE`. `check` treats that as LOGGED_OUT.

## Integration note for the backend engineer

```ts
import { withAuth, check, login } from './auth-broker/src/broker.js';

const CHECK = 'https://demo.openemr.io/openemr/interface/main/finder/dynamic_finder.php';
const LOGIN = 'https://demo.openemr.io/openemr/interface/login/login.php';

const result = await withAuth(CHECK, async (sessionFile) => {
  // Create the browser context with the saved session:
  const ctx = await browser.newContext({ storageState: sessionFile });
  // ...run the generated automation. THROW if it hits a login page or fails.
  return 'ok';
}, { loginUrl: LOGIN, sessionFile: 'sessions/<userId>-openemr.json' });
```

- **Session file**: `./sessions/<hostname>.json` relative to the process cwd, unless you pass `sessionFile`. It contains live session cookies, so treat it like a secret. For more than one user, use one file per user (e.g. `sessions/<userId>-<host>.json`). Do not commit it (`sessions/` is in `.gitignore`).
- **Throwing is the signal**: withAuth only re-checks and retries when `fn` throws. If the automation returns normally, it counts as success.
- **The headed window needs a display.** `login()` opens a real Chromium window on the machine running the backend. That is fine for the demo laptop, but it will not work on a headless server.
- **CLI exit codes**: `check` 0 = LOGGED_IN, 1 = LOGGED_OUT. `login` 0 = saved, 2 = LOGIN_TIMEOUT. `run` 0 = success; otherwise the wrapped command's own exit code, passed through; 2 = LOGIN_TIMEOUT. On any command: 3 = broker error (message on stderr), 64 = usage error.
- **Errors in code**: `login()` throws `LoginTimeoutError` (`.code === 'LOGIN_TIMEOUT'`). It throws `Error('LOGIN_WINDOW_CLOSED')` if the user closes the window.
- `onLoginPage` (code) / `AUTH_LOGIN_HOOK` (env, CLI) is a **test-only** hook that auto-fills the demo credentials. In the product, leave it unset so Mary types her own.

## Files
- `src/broker.ts`: `login`, `check`, `withAuth`, `runWithAuth`
- `src/cli.ts`: the `auth` CLI (`./auth` wrapper)
- `test/autofill-hook.ts`: TEST-ONLY. Types the public demo credentials from env and takes a screenshot of the pop-up before typing
- `test/probe-main.ts`: wrapped command for test (c)
- `test/expire-then-probe.ts`: wrapped command for (c2)
- `test/strip-cookies.ts`: forced logout for (b)
- `test/debug-*.ts`: the scripts used to find the right check URL
- `test-log.txt`: passing run. `test-log-run1-FAILED-*.txt` and `test-log-run2-FAILED-*.txt` are the earlier failed runs, kept as evidence
- `screenshots/`: login pop-up during (a), (c), (c2), plus the page loaded after the re-login in (c)
