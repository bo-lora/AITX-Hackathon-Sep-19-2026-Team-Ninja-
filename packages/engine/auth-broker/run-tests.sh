#!/bin/bash
# Runs tests (a), (b), (c) against the OpenEMR public demo. Appends to test-log.txt with timestamps.
# Headed windows WILL appear on screen for (a) and (c). Credentials are the PUBLIC demo ones
# (admin) and are passed only via env to the test hook; they are never echoed or logged.
cd "$(dirname "$0")"
export PLAYWRIGHT_BROWSERS_PATH=0
LOG=test-log.txt
URL=https://demo.openemr.io/openemr/interface/login/login.php
# Check URL: Patient Finder (read-only). NOT tabs/main.php: without its token_main it bounces a valid session to login.
MAIN=https://demo.openemr.io/openemr/interface/main/finder/dynamic_finder.php
SF=sessions/test-openemr.json
ts() { date '+%Y-%m-%dT%H:%M:%S%z'; }
say() { echo "[$(ts)] $*" | tee -a "$LOG"; }
SEC=$(mktemp)
run() { say "\$ $*"; : > "$SEC"; "$@" 2>&1 | while IFS= read -r l; do echo "[$(ts)]   $l"; done | tee -a "$LOG" "$SEC"; return "${PIPESTATUS[0]}"; }
export AUTH_LOGIN_HOOK=test/autofill-hook.ts
export TEST_LOGIN_USER=admin TEST_LOGIN_PASS=pass   # public demo admin account (coordinator decision 11:4x: demo uses admin)
export TEST_SCREENSHOT_DIR=screenshots

say "===== RUN START ====="
rm -f "$SF"

say "--- TEST (a): auth login (headed) -> auth check prints LOGGED_IN"
export TEST_SCREENSHOT_TAG=a
run ./auth login "$URL" --session "$SF"; A1=$?
say "login exit=$A1"
OUT=$(./auth check "$MAIN" --session "$SF" 2>>"$LOG"); A2=$?
say "check stdout='$OUT' exit=$A2"
if [ "$A1" = 0 ] && [ "$OUT" = LOGGED_IN ] && [ "$A2" = 0 ]; then say "TEST (a): PASS"; else say "TEST (a): FAIL"; fi

say "--- TEST (b): strip cookies from session file -> auth check prints LOGGED_OUT"
run node_modules/.bin/tsx test/strip-cookies.ts "$SF"
OUT=$(./auth check "$MAIN" --session "$SF" 2>>"$LOG"); B=$?
say "check stdout='$OUT' exit=$B"
if [ "$OUT" = LOGGED_OUT ] && [ "$B" = 1 ]; then say "TEST (b): PASS"; else say "TEST (b): FAIL"; fi
OUT=$(./auth check "$MAIN" --session sessions/does-not-exist.json 2>>"$LOG"); B2=$?
say "(b extra) missing session file: check stdout='$OUT' exit=$B2"

say "--- TEST (c): logged-out session -> auth run re-opens headed login, re-logs in, command succeeds"
export TEST_SCREENSHOT_TAG=c
say "pre-state: $(./auth check "$MAIN" --session "$SF" 2>/dev/null)"
run ./auth run --url "$MAIN" --login-url "$URL" --session "$SF" -- node_modules/.bin/tsx test/probe-main.ts; C=$?
say "auth run exit=$C"
OUT=$(./auth check "$MAIN" --session "$SF" 2>>"$LOG")
say "post-state: check stdout='$OUT'"
if [ "$C" = 0 ] && [ "$OUT" = LOGGED_IN ] && grep -q 'check: LOGGED_OUT' "$SEC" && grep -q 'login window open' "$SEC" && grep -q 'OK (main page loaded)' "$SEC"; then say "TEST (c): PASS (see stderr lines above: LOGGED_OUT -> login window -> probe OK)"; else say "TEST (c): FAIL"; fi

say "--- TEST (c2, extra): command fails mid-run because session expired -> check LOGGED_OUT -> headed re-login -> retried ONCE -> succeeds"
export TEST_SCREENSHOT_TAG=c2 C2_MARKER=$(mktemp -u)
run ./auth run --url "$MAIN" --login-url "$URL" --session "$SF" -- node_modules/.bin/tsx test/expire-then-probe.ts; C2=$?
say "auth run exit=$C2"
if [ "$C2" = 0 ] && grep -q 'invocation #2' "$SEC" && ! grep -q 'invocation #3' "$SEC" && grep -q 'retry once' "$SEC"; then say "TEST (c2): PASS"; else say "TEST (c2): FAIL"; fi

say "--- TEST (d, extra): command fails while session is LOGGED_IN -> NO retry, original exit code (7) passed through"
run ./auth run --url "$MAIN" --login-url "$URL" --session "$SF" -- sh -c 'echo "D wrapped command ran; exiting 7"; exit 7'; D=$?
say "auth run exit=$D"
if [ "$D" = 7 ] && [ "$(grep -c 'D wrapped command ran' "$SEC")" = 1 ] && grep -q 'not retrying' "$SEC"; then say "TEST (d): PASS"; else say "TEST (d): FAIL"; fi
say "===== RUN END ====="
