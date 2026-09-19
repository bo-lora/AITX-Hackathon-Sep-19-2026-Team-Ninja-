#!/bin/bash
# Endpoint tests for automation-server. The server under test must be started with the TEST-ONLY env:
#   AUTH_LOGIN_HOOK=<abs>/auth-broker/test/autofill-hook.ts REC_DRIVER=<abs>/automation-server/test/rec-driver.ts
#   TEST_LOGIN_USER / TEST_LOGIN_PASS (public demo creds; never printed)
# Appends to ../test-log.txt. Headed windows WILL appear. Creates one HACKDEMO-REC-* and one HACKDEMO-*-TR* patient.
HERE="$(cd "$(dirname "$0")/.." && pwd)"; B=${B:-http://localhost:4710}; LOG="$HERE/test-log.txt"; T="$HERE/test/out"; mkdir -p "$T"
say() { echo "$*" | tee -a "$LOG"; }
req() { # name method path [json] → writes $T/<name>.json, echoes HTTP code
  local n=$1 m=$2 p=$3 d=${4:-}
  if [ -n "$d" ]; then curl -s -o "$T/$n.json" -w '%{http_code}' -X "$m" -H 'content-type: application/json' -d "$d" "$B$p"
  else curl -s -o "$T/$n.json" -w '%{http_code}' -X "$m" "$B$p"; fi
}
verdict() { if [ "$1" = ok ]; then say "PASS $2"; else say "FAIL $2"; FAILS=$((FAILS+1)); fi; }
FAILS=0
say ""; say "=== automation-server endpoint tests $(date '+%Y-%m-%d %H:%M:%S %Z') against $B ==="

c=$(req health GET /health); verdict $([ "$c" = 200 ] && grep -q '"ok": true' "$T/health.json" && echo ok) "GET /health → HTTP $c $(tr -d '\n ' < "$T/health.json" | cut -c1-120)"
c=$(req cors OPTIONS /run); verdict $([ "$c" = 204 ] && echo ok) "OPTIONS /run (CORS preflight) → HTTP $c"

c=$(req login POST /login); verdict $([ "$c" = 200 ] && grep -q LOGGED_IN "$T/login.json" && echo ok) "POST /login → HTTP $c $(tr -d '\n ' < "$T/login.json")"
c=$(req status GET /status); verdict $([ "$c" = 200 ] && grep -q '"LOGGED_IN"' "$T/status.json" && echo ok) "GET /status → HTTP $c $(tr -d '\n ' < "$T/status.json")"

# /record in the background, then prove one-job-at-a-time with a concurrent /login and /run
( c=$(req record POST /record '{}'); echo "$c" > "$T/record.code" ) &
RP=$!
for i in $(seq 1 40); do grep -q '"busy": "record"' <(curl -s $B/health) && break; sleep 0.5; done
c=$(req busy_login POST /login); verdict $([ "$c" = 409 ] && echo ok) "POST /login while /record runs → HTTP $c $(tr -d '\n ' < "$T/busy_login.json")"
c=$(req busy_run POST /run '{}'); verdict $([ "$c" = 409 ] && echo ok) "POST /run while /record runs → HTTP $c $(tr -d '\n ' < "$T/busy_run.json")"
wait $RP; c=$(cat "$T/record.code")
REC=$(python3 - "$T/record.json" <<'EOF'
import json,sys
r=json.load(open(sys.argv[1])); ev=r.get('events',[])
top=('/interface/main/tabs/main.php','/interface/login/login.php')
inner=[e for e in ev if e.get('kind') in('click','fill') and e.get('frame_url') and not any(t in e['frame_url'] for t in top)]
lab=[e for e in inner if (e.get('label') or e.get('text'))]
pw=[e for e in ev if e.get('type')=='password']
pw_ok=all(e.get('value') in (None,'[hidden]') for e in pw)
fills=[f"{e.get('label') or e.get('text')!r}={e.get('value')!r}" for e in inner if e['kind']=='fill'][:6]
ok=bool(inner) and len(lab)==len(inner) and pw_ok and len(pw)>0
print(('ok' if ok else 'bad')+f" id={r.get('id')} events={len(ev)} iframe_events={len(inner)} iframe_events_with_label={len(lab)} password_events={len(pw)} password_masked={pw_ok} sample_iframe_fills={fills}")
EOF
)
verdict $([ "$c" = 200 ] && [ "${REC%% *}" = ok ] && echo ok) "POST /record → HTTP $c ${REC#* }"
c=$(req rec_latest GET /recordings/latest); verdict $([ "$c" = 200 ] && echo ok) "GET /recordings/latest → HTTP $c ($(wc -c < "$T/rec_latest.json" | tr -d ' ') bytes)"

c=$(req run POST /run "{\"commands_file\":\"$HERE/commands.referral-1.json\"}")
RUN=$(python3 - "$T/run.json" <<'EOF'
import json,sys,os
r=json.load(open(sys.argv[1])); rid=r.get('run_id')
f=os.path.join(os.path.dirname(sys.argv[1]), "..", "..", "..", "test-runner", "runs", str(rid), "report.json")
rep=json.load(open(f)) if rid and os.path.exists(f) else {}
steps=[s for it in rep.get('items',[]) for s in it.get('steps',[])]+rep.get('setup',[])
conf=[s['id'] for s in steps if str(s.get('status','')).startswith('Confirmed')]
hyp=[f"{s['id']}: {str(s.get('reason',''))[:90]}" for s in steps if not str(s.get('status','')).startswith('Confirmed')]
print(('ok' if conf else 'bad')+f" run_id={rid} report.json_exists={os.path.exists(f) if rid else False} totals={r.get('totals')} confirmed={conf} not_confirmed={hyp}")
EOF
)
verdict $([ "$c" = 200 ] && [ "${RUN%% *}" = ok ] && echo ok) "POST /run (1 referral) → HTTP $c ${RUN#* }"
c=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' $B/report/latest); verdict $([ "${c%% *}" = 302 ] && echo ok) "GET /report/latest → $c"
c=$(req rep_latest GET /report/latest.json); verdict $([ "$c" = 200 ] && echo ok) "GET /report/latest.json → HTTP $c ($(wc -c < "$T/rep_latest.json" | tr -d ' ') bytes)"
say "=== done: $FAILS failure(s). Raw responses: $T ==="
exit $FAILS
