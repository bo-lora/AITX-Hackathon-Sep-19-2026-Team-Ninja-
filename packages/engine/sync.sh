#!/bin/bash
# sync.sh — re-copy the working tool folders into this repo (COPY ONLY; the originals are never modified).
# Source: ~/hackathon-2026-09-19/<tool>/   Destination: this repo, same folder names (so ../ paths between tools still work).
# Excludes: node_modules, .venv, sessions/ (Playwright storageState = cookies), .oe-state* (runner session state),
# screenshots, scratch/, server logs, per-folder package-lock.json, in-progress staged/ drafts.
# rsync --delete / --delete-excluded act on the DESTINATION (this repo) only.
set -euo pipefail
SRC="${HACK_SRC:-$HOME/hackathon-2026-09-19}"
DST="$(cd "$(dirname "$0")" && pwd)"
[ "$SRC" = "$DST" ] && { echo "refusing: SRC == DST"; exit 1; }

EXCLUDES=(
  --exclude node_modules --exclude .venv --exclude __pycache__ --exclude .DS_Store
  --exclude 'sessions*/' --exclude '*-sessions/' --exclude 'test-sessions/' --exclude 'storageState*' --exclude '*.session.json'
  --exclude '.oe-state*' --exclude 'cookies*' --exclude '*cookie*.json'
  --exclude '*.png' --exclude '*.jpg' --exclude '*.jpeg' --exclude '*.webm' --exclude '*.mp4'
  --exclude screenshots/ --exclude shots/ --exclude scratch/ --exclude recordings/
  --include 'evidence/' --include 'evidence/final/***' --exclude 'evidence/*'
  --exclude 'server.log*' --exclude 'server.test.log' --exclude 'install-local.log' --exclude 'staged/'
  --exclude '*.sqlite' --exclude '*.sqlite3' --exclude '*.db' --exclude package-lock.json --exclude READY --exclude .gitignore
  --include '.env.example' --exclude '.env' --exclude '.env.*' --exclude '*.key' --exclude '*.pem'
)

TOOLS=(auth-broker extract openemr-cli automation-server test-runner triage from-recording referrals docs-facts ground-truth supabase-sync docs-crawl)
for t in "${TOOLS[@]}"; do
  if [ -d "$SRC/$t" ]; then
    mkdir -p "$DST/$t"
    EXTRA=()
    # from-recording/inputs/ = raw Chrome Recorder exports containing live session URLs: never copied.
    [ "$t" = from-recording ] && EXTRA=(--exclude '/inputs/')
    rsync -a --delete --delete-excluded "${EXTRA[@]+"${EXTRA[@]}"}" "${EXCLUDES[@]}" "$SRC/$t/" "$DST/$t/"
    echo "synced $t"
  else
    echo "SKIP $t (not present in $SRC yet)"
  fi
done

# The "drop this into your AI" setup prompt (Mary's final output) lives in submission/; copy just that file.
mkdir -p "$DST/docs"
[ -f "$SRC/submission/setup-prompt.md" ] && cp "$SRC/submission/setup-prompt.md" "$DST/docs/setup-prompt.md" && echo "synced docs/setup-prompt.md"

# Patch the COPY only: openemr-cli's default session path pointed at the author's home folder.
if [ -f "$DST/openemr-cli/openemr.ts" ]; then
  sed -i '' "s#path.join(os.homedir(), 'hackathon-2026-09-19/automation-server/sessions/openemr.json')#path.join(HACK, 'automation-server/sessions/openemr.json')#" "$DST/openemr-cli/openemr.ts"
fi

# from-recording/score.py read the ground truth from the author's home folder; point it at this repo's copy.
if [ -f "$DST/from-recording/score.py" ]; then
  sed -i '' 's#os.path.expanduser("~/hackathon-2026-09-19/ground-truth/workflow.md")#os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ground-truth", "workflow.md")#' "$DST/from-recording/score.py"
fi
# automation-server/test/run-tests.sh: the report path was absolute; derive it from the test-output file instead
# (sys.argv[1] = <repo>/automation-server/test/out/run.json -> 4 dirnames up = <repo>).
if [ -f "$DST/automation-server/test/run-tests.sh" ]; then
  sed -i '' 's#f=f"/Users/[^/]*/hackathon-2026-09-19/test-runner/runs/{rid}/report.json"#f=os.path.join(os.path.dirname(sys.argv[1]), "..", "..", "..", "test-runner", "runs", str(rid), "report.json")#' "$DST/automation-server/test/run-tests.sh"
fi
# Remaining absolute author paths in copied docs/logs/comments -> "<repo>" (readability; no behaviour change).
grep -rlI -e "/Users/[^/]*/hackathon-2026-09-19" -e "~/hackathon-2026-09-19" -e "\$HOME/hackathon-2026-09-19" "$DST" --exclude=sync.sh --exclude=secrets-scan.sh --exclude-dir=.git --exclude-dir=node_modules 2>/dev/null | while read -r f; do
  sed -i '' -e "s#/Users/[^/]*/hackathon-2026-09-19#<repo>#g" -e "s#~/hackathon-2026-09-19#<repo>#g" -e "s#\$HOME/hackathon-2026-09-19#<repo>#g" "$f"
done

# Python code that used ~/hackathon-2026-09-19/... (now "<repo>/...") -> resolve relative to the script's own folder.
git_free_py=$(grep -rlF 'os.path.expanduser("<repo>/' "$DST" --include='*.py' --exclude-dir=.git --exclude-dir=node_modules 2>/dev/null || true)
for f in $git_free_py; do
  sed -i '' -E 's#os\.path\.expanduser\("<repo>/([^"]*)"\)#os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "\1")#g' "$f"
done
[ -f "$DST/supabase-sync/wait-for-keys.sh" ] && sed -i '' 's#^ENVF="<repo>/.env"#ENVF="$(cd "$(dirname "$0")/.." \&\& pwd)/.env"#' "$DST/supabase-sync/wait-for-keys.sh"

# Screenshots are NOT in the repo (some show the shared Patient Finder with non-HACKDEMO demo patients).
# Replace <img> tags that point at shots/ in copied report/review pages with a placeholder.
for f in $(find "$DST/test-runner/runs" "$DST/automation-server/intake" -name '*.html' 2>/dev/null); do
  sed -i '' -E 's#<img[^>]*src="[^"]*shots/[^"]*"[^>]*>#<span class="shot-omitted">[screenshot not included in the repo]</span>#g' "$f"
done

# Strip OpenEMR's per-login main.php token (token_main=...) from captured URLs (recorder/test output, reports) in the COPY.
grep -rlIE "token_main=" "$DST" --exclude=sync.sh --exclude=secrets-scan.sh --exclude-dir=.git --exclude-dir=node_modules 2>/dev/null | while read -r f; do
  sed -i '' -E "s#token_main=[^\"&[:space:]]*#<redacted>#g" "$f"
done

date "+synced at %Y-%m-%d %H:%M:%S %Z"
