"""Unit + end-to-end tests of supabase-sync against the local mock. Run: python3 test/test_sync.py"""
import io, os, re, sys, tempfile, contextlib, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent)); sys.path.insert(0, str(Path(__file__).resolve().parent))
import supabase_sync as S, mock_supabase as M

ROOT = S.ROOT
INTAKE = ROOT / 'automation-server' / 'intake' / '20260919_173031'
RUN = ROOT / 'test-runner' / 'runs' / '2026-09-19_121306'
fails = 0
def check(name, cond):
    global fails; print(('PASS ' if cond else 'FAIL ') + name); fails += (not cond)

def quiet(f, *a):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf): rc = f(*a)
    return rc, buf.getvalue()

# 1. no keys → exit 0, nothing written
empty = Path(tempfile.mkdtemp()) / '.env'; empty.write_text('')
rc, out = quiet(S.main, [str(INTAKE), '--env', str(empty)])
check('no keys: exit 0 and skipped', rc == 0 and 'keys absent' in out)

# 2. safety check unit cases
b = S.load_bundle(INTAKE); rows = S.build_rows(b)
ok, _ = S.safety_check([('index.html', b'<p>ok</p>', 'text/html', 'x')], rows, ['supersecretvalue123'])
check('safety: clean html passes', ok)
for label, f in [('PHPSESSID', ('a.html', b'PHPSESSID=abc', 'text/html', 'x')),
                 ('cookie word', ('a.html', b'document.Cookie', 'text/html', 'x')),
                 ('literal key', ('a.html', b'xx supersecretvalue123 xx', 'text/html', 'x')),
                 ('session json name', ('sessions/main.json', b'{}', 'application/json', 'sessions/main.json')),
                 ('storageState name', ('storageState.json', b'{}', 'application/json', 'x')),
                 ('SERVICE_ROLE', ('a.html', b'SUPABASE_SERVICE_ROLE_KEY', 'text/html', 'x')),
                 ('withheld screenshot', ('run/shots/r01-patient-before.png', b'png', 'image/png', 'x')),
                 ('setup screenshot', ('run/shots/setup-login-verify.png', b'png', 'image/png', 'x'))]:
    ok, _ = S.safety_check([f], rows, ['supersecretvalue123']); check(f'safety: {label} blocked', not ok)
bad = (rows[0], [dict(rows[1][0], patient_last='Adeyemi')] + rows[1][1:], rows[2], rows[3])
ok, lines = S.safety_check([('run/shots/r01-patient-verify.png', b'png', 'image/png', 'x')], bad, [])
check('safety: non-HACKDEMO patient blocks run + its screenshots', not ok and any('non-HACKDEMO' in l for l in lines))
pdf = (ROOT / 'referrals' / 'referral-01.pdf').read_bytes()
ok, _ = S.safety_check([('pdfs/referral-01.pdf', pdf, 'application/pdf', 'x')], rows, []); check('safety: HACKDEMO PDF passes', ok)

b2 = dict(b, review_json={'referral-01.pdf': {'verdict': 'looks_right', 'at': '2026-09-19T18:00:00Z'}, 'referral-02.pdf': {'verdict': 'bogus'}})
rv = S.build_rows(b2)[3]
check('reviews: review.json verdicts become reviews rows (invalid verdicts dropped)', len(rv) == 1 and rv[0]['verdict'] == 'looks_right')

# 3. link rewrite of a server-built review page
fake = '<a href="/intake/20260919_173031/pdfs/referral-01.pdf">x</a><img src="/intake/20260919_173031/shots/referral-01/final-1.png"><script>async function mark(b,v){fetch("/review/x/mark")}</script>'
out = S.rewrite_review(fake, b)
check('rewrite: /intake/<id>/ links made relative', 'href="pdfs/referral-01.pdf"' in out and 'src="shots/referral-01/final-1.png"' in out)
check('rewrite: mark() no longer posts to local server', '/review/' not in out)

# 4. end-to-end against the mock: upload, upsert, then fetch every link of the public page
srv = M.start(); url = f'http://127.0.0.1:{srv.server_address[1]}'
envf = Path(tempfile.mkdtemp()) / '.env'; envf.write_text(f'SUPABASE_URL={url}\nSUPABASE_SERVICE_ROLE_KEY="{M.KEY}"\n')
for d in (INTAKE, RUN):
    rc, out = quiet(S.main, [str(d), '--env', str(envf)])
    check(f'e2e {d.name}: exit 0', rc == 0)
    check(f'e2e {d.name}: key value never printed', M.KEY not in out and M.KEY not in S.LOG.read_text())
    pub = re.search(r'PUBLIC URL: (\S+)', out).group(1)
    base = pub.rsplit('/', 1)[0] + '/'
    pages = [pub, base + 'run/report.html']; bad_links = []; n = 0
    for p in pages:
        html = urllib.request.urlopen(p).read().decode()
        for link in set(re.findall(r'(?:href|src)="([^"#]+)"', html)):
            if link.startswith('http'): continue
            n += 1
            full = (p.rsplit('/', 1)[0] + '/' + link)
            try: st = urllib.request.urlopen(full).status
            except urllib.error.HTTPError as e: st = e.code
            if st != 200: bad_links.append((link, st))
    check(f'e2e {d.name}: all {n} relative links on public pages return 200 {bad_links[:3]}', not bad_links and n > 0)
    run_id = re.search(r'demo-runs/([^/]+)/', pub).group(1)
    counts = {t: len([r for r in M.STATE['tables'][t].values() if r.get('run_id', r.get('id')) == run_id]) for t in M.STATE['tables']}
    print('   mock row counts', counts)
    check(f'e2e {d.name}: runs=1, referrals>0, steps>0', counts['runs'] == 1 and counts['referrals'] > 0 and counts['steps'] > 0)
    check(f'e2e {d.name}: no session/json objects uploaded', not any(o.endswith('.json') for (_, o) in M.STATE['objects']))
# idempotent re-run
rc, _ = quiet(S.main, [str(INTAKE), '--env', str(envf)])
check('e2e: re-sync is idempotent (still 1 run row)', len([r for r in M.STATE['tables']['runs'].values() if r['id'] == '2026-09-19_123032']) == 1)
print('ALL PASS' if not fails else f'{fails} FAILED'); sys.exit(1 if fails else 0)
