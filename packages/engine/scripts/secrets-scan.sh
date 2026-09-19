#!/bin/bash
# secrets-scan.sh — run from the repo root. Scans COMMITTED files (git grep) for login/session material.
# Exit 1 if any hard finding (session file, cookie value, token, key). The public OpenEMR demo login is listed, not failed.
cd "$(dirname "$0")/.." || exit 2
HARD=0
echo "== 1. files per search term (case-insensitive, committed files)"
for t in pass cookie PHPSESSID storageState Authorization SERVICE_ROLE apify_api_ token_main=; do
  printf "  %-14s %s files\n" "$t" "$(git grep -il -- "$t" | wc -l | tr -d ' ')"
done

echo "== 2. session / cookie / state / .env / key FILES tracked (want: none; .env.example allowed)"
F=$(git ls-files | grep -iE '(^|/)[^/]*sessions[^/]*/|storagestate|cookies?\.json|\.oe-state|\.session\.json|(^|/)\.env(\.[^/]*)?$|\.pem$|\.key$' | grep -v '\.env\.example$')
if [ -n "$F" ]; then echo "$F"; HARD=1; else echo "  none"; fi

echo "== 2b. image / video files tracked (want: none; screenshots may show non-HACKDEMO demo patients)"
F=$(git ls-files | grep -iE '\.(png|jpe?g|gif|webp|webm|mp4|mov)$')
if [ -n "$F" ]; then echo "$F"; HARD=1; else echo "  none"; fi

echo "== 3. Playwright storageState content (a \"cookies\": [ array or \"origins\": [ with localStorage) (want: none)"
F=$(git grep -lE '"cookies"[[:space:]]*:[[:space:]]*\[|"localStorage"[[:space:]]*:[[:space:]]*\[')
if [ -n "$F" ]; then echo "$F"; HARD=1; else echo "  none"; fi

echo "== 4. cookie / token / key VALUES (incl. apify_api_*, SERVICE_ROLE_KEY=<value>, APIFY_TOKEN=<value>, JWTs)"
echo "  (want: none; ignores the 'Bearer YOUR_...' placeholders in saved public OpenEMR docs)"
F=$(git grep -nE 'PHPSESSID=[A-Za-z0-9]{8,}|OpenEMR=[A-Za-z0-9]{8,}|Set-Cookie:|Cookie:[[:space:]]*[A-Za-z0-9_]+=|Bearer [A-Za-z0-9._-]{16,}|sk-ant-[A-Za-z0-9]|ANTHROPIC_API_KEY=[^[:space:]$]+|apify_api_[A-Za-z0-9]{6,}|SERVICE_ROLE_KEY[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9._-]{8,}|APIFY_TOKEN[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}|csrf_token[^a-z]{0,6}[A-Za-z0-9]{16,}' -- ':!scripts/secrets-scan.sh' ':!sync.sh' | grep -vE 'Bearer YOUR_[A-Z_]+')
if [ -n "$F" ]; then echo "$F" | cut -c1-200; HARD=1; else echo "  none"; fi

echo "== 4b. ANY 'token_main=' (OpenEMR session token in a URL) outside this script and sync.sh (want: none)"
F=$(git grep -n 'token_main=' -- ':!scripts/secrets-scan.sh' ':!sync.sh')
if [ -n "$F" ]; then echo "$F" | cut -c1-200; HARD=1; else echo "  none"; fi

echo "== 5. 'Authorization' occurrences (want: only placeholder examples in saved public OpenEMR docs)"
git grep -n 'Authorization' -- ':!scripts/secrets-scan.sh' | cut -c1-160

echo "== 6. credential literals: the public OpenEMR demo login (admin/pass, receptionist/receptionist) — listed, labelled in README"
git grep -nE -- '--pass [^ "]+|TEST_LOGIN_PASS=[^ ]+|admin ?/ ?pass|receptionist ?/ ?receptionist|`admin` / `pass`' -- ':!scripts/secrets-scan.sh' | cut -c1-140
echo "  any OTHER --pass value (want: none):"
O=$(git grep -hoE -- '--pass [A-Za-z0-9_$]+' -- ':!scripts/secrets-scan.sh' ':!README.md' | sort -u | grep -vE -- '^--pass (pass|receptionist)$')
if [ -n "$O" ]; then echo "$O"; HARD=1; else echo "  none"; fi

echo "== RESULT: $([ $HARD = 0 ] && echo 'PASS (no session files, cookie values, tokens or keys; only the public demo login)' || echo 'FAIL — see above')"
exit $HARD
