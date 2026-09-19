#!/usr/bin/env python3
"""supabase-sync <run_dir|intake_dir> [--dry-run] [--reviews-only] [--env FILE]

Upserts one OpenEMR intake run into Supabase (tables runs/referrals/steps/reviews, see schema.sql)
and uploads a standalone review page + report.html + screenshots + referral PDFs to the PUBLIC
Storage bucket 'demo-runs'. Prints the public URL.

OPTIONAL by design: if SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are absent it prints
"keys absent" and exits 0. Key values are never printed or logged.
Every public upload is preceded by a safety check (see safety_check); if it fails, nothing is uploaded.
Python 3 stdlib only.
"""
import html, json, mimetypes, os, re, subprocess, sys, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent                      # <repo>
DEFAULT_ENV = ROOT / '.env'
BUCKET = 'demo-runs'
LOG = HERE / 'sync.log'
FORBIDDEN = ['PHPSESSID', 'cookie', 'storageState', 'Authorization', 'SERVICE_ROLE']
# Only these screenshots are published: they show ONE HACKDEMO patient's own dashboard/insurance/documents page.
# before/after/setup shots are withheld: observed 12:55 that 'before' and 'setup-login' shots show the shared Patient
# Finder list with other public users' (non-HACKDEMO) patients.
PUBLISHABLE_PNG = re.compile(r'(^|/)(r\d+-[a-z]+-verify|final-\d+)\.png$')
SESSIONISH = re.compile(r'(session|cookie|storage[-_]?state|auth[^/]*\.json$)', re.I)


def log(*m):
    line = ' '.join(str(x) for x in m)
    print(line)
    with open(LOG, 'a') as f:
        f.write(time.strftime('%H:%M:%S ') + line + '\n')


# ---------- env (dotenv loader; values never printed) ----------
def load_env(path):
    vals = {}
    p = Path(path)
    if p.exists():
        for raw in p.read_text().splitlines():
            s = raw.strip()
            if not s or s.startswith('#') or '=' not in s:
                continue
            k, v = s.split('=', 1)
            k = k.strip().removeprefix('export ').strip()
            v = v.strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'':
                v = v[1:-1]
            vals[k] = v
    for k in ('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'):
        if os.environ.get(k):
            vals[k] = os.environ[k]
    return vals


# ---------- Supabase REST client ----------
class Supa:
    def __init__(self, url, key):
        self.url = url.rstrip('/')
        self._key = key

    def req(self, method, path, body=None, headers=None, raw=False):
        h = {'apikey': self._key, 'Authorization': 'Bearer ' + self._key}
        h.update(headers or {})
        data = None
        if body is not None:
            if raw:
                data = body
            else:
                data = json.dumps(body).encode()
                h.setdefault('Content-Type', 'application/json')
        r = urllib.request.Request(self.url + path, data=data, method=method, headers=h)
        try:
            with urllib.request.urlopen(r, timeout=60) as resp:
                return resp.status, dict(resp.headers), resp.read()
        except urllib.error.HTTPError as e:
            return e.code, dict(e.headers), e.read()

    def upsert(self, table, rows, on_conflict):
        if not rows:
            return 201, b''
        st, _, b = self.req('POST', f'/rest/v1/{table}?on_conflict={on_conflict}', rows,
                            {'Prefer': 'resolution=merge-duplicates,return=minimal'})
        return st, b

    def count(self, table, flt=''):
        st, h, b = self.req('GET', f'/rest/v1/{table}?select=*&limit=1{flt}', headers={'Prefer': 'count=exact'})
        cr = {k.lower(): v for k, v in h.items()}.get('content-range', '')
        return (int(cr.split('/')[-1]) if st < 300 and '/' in cr and cr.split('/')[-1].isdigit() else None), st

    def ensure_bucket(self):
        st, _, b = self.req('POST', '/storage/v1/bucket', {'id': BUCKET, 'name': BUCKET, 'public': True})
        if st >= 300 and b'already exists' not in b.lower() and b'duplicate' not in b.lower():
            self.req('PUT', f'/storage/v1/bucket/{BUCKET}', {'id': BUCKET, 'name': BUCKET, 'public': True})
        self.req('PUT', f'/storage/v1/bucket/{BUCKET}', {'id': BUCKET, 'name': BUCKET, 'public': True})
        return st

    def upload(self, obj_path, data, ctype):
        return self.req('POST', f'/storage/v1/object/{BUCKET}/{urllib.parse.quote(obj_path)}', data,
                        {'Content-Type': ctype, 'x-upsert': 'true', 'cache-control': 'max-age=60'}, raw=True)[0]

    def public_url(self, obj_path):
        return f'{self.url}/storage/v1/object/public/{BUCKET}/{urllib.parse.quote(obj_path)}'


# ---------- read a run / intake dir into one normalized bundle ----------
def status_mark(s):
    return '✓' if str(s or '').startswith('Confirmed') else '?'


def load_bundle(d):
    d = Path(d).resolve()
    b = {'dir': d, 'intake': None, 'report': None, 'run_dir': None, 'review_html': None, 'review_json': None}
    if (d / 'intake.json').exists():
        b['intake'] = json.loads((d / 'intake.json').read_text())
        if (d / 'review.html').exists():
            b['review_html'] = d / 'review.html'
        if (d / 'review.json').exists():
            b['review_json'] = json.loads((d / 'review.json').read_text())
        rid = b['intake'].get('run_id')
        for cand in ([ROOT / 'test-runner' / 'runs' / rid, ROOT / 'automation-server' / 'runs' / rid] if rid else []):
            if (cand / 'report.json').exists():
                b['run_dir'] = cand
                break
    elif (d / 'report.json').exists():
        b['run_dir'] = d
    else:
        raise SystemExit(f'supabase-sync: {d} has neither intake.json nor report.json')
    if b['run_dir']:
        b['report'] = json.loads((b['run_dir'] / 'report.json').read_text())
    return b


def extracted_by_file(b):
    out = {}
    for base in [b['dir'], ROOT / 'extract']:
        f = base / 'extracted.json'
        if f.exists():
            try:
                for x in json.loads(f.read_text()):
                    out.setdefault(x.get('file'), x)
            except Exception:
                pass
    for r in (b['intake'] or {}).get('referrals', []) or []:
        if r.get('file') and r.get('extracted'):
            out[r['file']] = r['extracted']
    return out


def build_rows(b, public_url=None):
    I, R = b['intake'] or {}, b['report'] or {}
    run_id = I.get('run_id') or (b['run_dir'].name if b['run_dir'] else None) or I.get('intake_id')
    site = R.get('target_url') or I.get('site_url') or I.get('site') or ''
    intake_id = I.get('intake_id')
    run = {'id': run_id, 'intake_id': intake_id, 'site': site, 'started_at': R.get('started_at'),
           'finished_at': R.get('finished_at'), 'totals': R.get('totals') or I.get('totals') or {'summary': I.get('summary')},
           'public_url': public_url}
    ex = extracted_by_file(b)
    referrals, steps, reviews = [], [], []
    if R.get('items'):
        for it in R['items']:
            pdf = Path(str(it.get('vars', {}).get('PDF', ''))).name
            x = ex.get(pdf, {})
            referrals.append({'run_id': run_id, 'referral': it['id'], 'file': pdf,
                              'patient_last': it.get('vars', {}).get('LNAME') or x.get('last_name'),
                              'extracted': x or None, 'triage_flags': x.get('flags') if isinstance(x.get('flags'), list) else None,
                              'status': it.get('status')})
            for s in it.get('steps', []):
                steps.append({'run_id': run_id, 'referral': it['id'], 'step': s['id'], 'status': status_mark(s.get('status')),
                              'status_text': s.get('status'), 'readback': (s.get('verify_stdout_tail') or '').strip()[:2000],
                              'seconds': s.get('seconds')})
        for s in R.get('setup', []):
            steps.append({'run_id': run_id, 'referral': 'setup', 'step': s['id'], 'status': status_mark(s.get('status')),
                          'status_text': s.get('status'), 'readback': (s.get('verify_stdout_tail') or '').strip()[:2000],
                          'seconds': s.get('seconds')})
    else:  # /intake output with no linked test-runner run (openemr-cli backend)
        for i, r in enumerate(I.get('referrals', []) or [], 1):
            x = r.get('extracted') or {}
            ref = f'r{i:02d}'
            referrals.append({'run_id': run_id, 'referral': ref, 'file': r.get('file'),
                              'patient_last': (r.get('cli') or {}).get('patient', {}).get('last') or x.get('last_name'),
                              'extracted': x or None, 'triage_flags': r.get('flags') or None, 'status': r.get('status')})
            for s in (r.get('cli') or {}).get('steps', []) or []:
                steps.append({'run_id': run_id, 'referral': ref, 'step': s.get('step'), 'status': status_mark(s.get('status')),
                              'status_text': s.get('status'), 'readback': json.dumps(s.get('readback'))[:2000] if s.get('readback') else None,
                              'seconds': s.get('seconds')})
    # triage flags from the intake's triage.json, if present
    tj = b['dir'] / 'triage.json'
    if tj.exists():
        try:
            tri = {t['file']: t for t in json.loads(tj.read_text()).get('referrals', [])}
            for r in referrals:
                if r['file'] in tri:
                    r['triage_flags'] = tri[r['file']].get('flags')
        except Exception:
            pass
    for f, v in (b['review_json'] or {}).items():
        if v.get('verdict') in ('looks_right', 'something_wrong'):
            reviews.append({'run_id': run_id, 'referral': f, 'verdict': v['verdict'], 'note': v.get('note'),
                            'at': v.get('at') or time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())})
    return run, referrals, steps, reviews


# ---------- files to publish ----------
def rewrite_review(text, b, run_prefix='run/'):
    iid = (b['intake'] or {}).get('intake_id', '')
    text = text.replace(f'/intake/{iid}/', '')
    if b['run_dir']:
        text = text.replace(f'/runs/{b["run_dir"].name}/', run_prefix)
    # the Looks right / Something's wrong buttons post to the local server; the public copy is read-only
    text = re.sub(r'<script>async function mark.*?</script>',
                  '<script>function mark(b){b.parentElement.querySelector(".saved").textContent='
                  '"read-only public copy: verdicts are recorded on Mary\'s local review page";}</script>', text, flags=re.S)
    return redact(text)


def unlink_withheld(text):
    # links to withheld screenshots become plain text so the public page has no dead links
    text = re.sub(r'<a ([^>]*?)href="(shots/[^"]+\.png)"([^>]*)>(.*?)</a>',
                  lambda m: m.group(0) if PUBLISHABLE_PNG.search(m.group(2)) else f'<span title="not published">{m.group(4)}</span>',
                  text, flags=re.S)
    text = re.sub(r'<img [^>]*?src="(shots/[^"]+\.png)"[^>]*>',
                  lambda m: m.group(0) if PUBLISHABLE_PNG.search(m.group(1)) else
                  '<span class="withheld" style="display:inline-block;padding:30px 8px;background:#eee;color:#667;font-size:12px">'
                  'screenshot not published (it can show other public-demo patients)</span>', text)
    return text


def redact(text):
    return text.replace(str(ROOT) + '/', '').replace(str(Path.home()), '~')


def generated_index(b, rows):
    run, referrals, steps, _ = rows
    esc = lambda s: html.escape(str(s if s is not None else ''))
    t = run.get('totals') or {}
    cards = []
    for r in referrals:
        x = r.get('extracted') or {}
        st = [s for s in steps if s['referral'] == r['referral']]
        fields = ''.join(f'<tr><th>{esc(k.replace("_", " "))}</th><td>{esc(x.get(k))}</td></tr>' for k in
                         ['first_name', 'last_name', 'dob', 'sex', 'phone', 'address_street', 'address_city', 'address_zip',
                          'insurance_carrier', 'member_id', 'group_number', 'referring_provider', 'urgency'] if x.get(k) is not None)
        shots = ''.join(f'<a href="run/shots/{esc(r["referral"])}-{esc(s["step"])}-verify.png" target="_blank">{esc(s["step"])} screenshot</a> '
                        for s in st)
        cards.append(f'''<section class="card"><header><h2>{esc(x.get("first_name"))} {esc(r.get("patient_last"))}</h2>
<span class="badge">{esc(r.get("status"))}</span></header>
<p><a href="pdfs/{esc(r["file"])}" target="_blank">📄 {esc(r["file"])}</a> (input referral PDF)</p>
<table>{fields}</table>
<p class="steps">{" · ".join(f"{esc(s['step'])}: <b>{esc(s['status_text'])}</b> ({esc(s['seconds'])}s)" for s in st)}</p>
<p>{shots}</p></section>''')
    return f'''<!doctype html><meta charset="utf-8"><title>Mary's review — {esc(run["id"])}</title>
<style>body{{font:15px/1.45 -apple-system,system-ui,sans-serif;max-width:1000px;margin:24px auto;padding:0 16px;color:#1d2330;background:#f6f7f9}}
.card{{background:#fff;border-radius:10px;padding:14px 18px;margin:14px 0;border-left:6px solid #2e9d5b;box-shadow:0 1px 3px #0001}}
header{{display:flex;gap:12px;align-items:center}}h2{{margin:0;font-size:19px}}.badge{{padding:2px 9px;border-radius:12px;font-size:13px;background:#e3f4ea}}
table{{font-size:13px;border-collapse:collapse}}th,td{{text-align:left;padding:2px 10px 2px 0}}th{{color:#667;font-weight:500}}.steps{{font-size:13px}}</style>
<h1>Mary's review (public audit copy)</h1>
<p>{esc(run["site"])} · run {esc(run["id"])} · {esc(t.get("headline", ""))} · {esc(t.get("steps_confirmed"))}/{esc(t.get("steps"))} steps confirmed</p>
<p><a href="run/report.html" target="_blank">Full step-by-step report with before/after/verify screenshots</a></p>
{"".join(cards)}'''


def collect_files(b, rows):
    """Returns list of (object_rel_path, bytes, content_type, source_description)."""
    run, referrals, steps, _ = rows
    files = []
    if b['review_html']:
        files.append(('index.html', rewrite_review(b['review_html'].read_text(), b).encode(), 'text/html; charset=utf-8', str(b['review_html'])))
    else:
        files.append(('index.html', generated_index(b, rows).encode(), 'text/html; charset=utf-8', 'generated from intake/report json'))
    if b['run_dir']:
        rep = b['run_dir'] / 'report.html'
        if rep.exists():
            files.append(('run/report.html', unlink_withheld(redact(rep.read_text())).encode(), 'text/html; charset=utf-8', str(rep)))
        for p in sorted((b['run_dir'] / 'shots').glob('*.png')):
            if PUBLISHABLE_PNG.search(p.name):
                files.append((f'run/shots/{p.name}', p.read_bytes(), 'image/png', str(p)))
    for p in sorted((b['dir'] / 'shots').rglob('*.png')) if (b['dir'] / 'shots').exists() else []:
        if PUBLISHABLE_PNG.search(p.name):
            files.append((f'shots/{p.relative_to(b["dir"] / "shots")}', p.read_bytes(), 'image/png', str(p)))
    # referral PDFs: prefer the intake's own copy, else the canonical referrals/ folder
    for r in referrals:
        f = r.get('file')
        if not f:
            continue
        for src in [b['dir'] / 'pdfs' / f, ROOT / 'referrals' / f]:
            if src.exists():
                files.append((f'pdfs/{f}', src.read_bytes(), 'application/pdf', str(src)))
                break
    return files


# ---------- safety check (must pass before ANY public upload) ----------
def pdf_text(data):
    try:
        return subprocess.run(['pdftotext', '-', '-'], input=data, capture_output=True, timeout=20).stdout.decode('utf8', 'replace')
    except Exception:
        return None


def safety_check(files, rows, secrets):
    """Returns (ok, lines). Fails on: session/cookie/storageState files; forbidden tokens or literal key values in
    any text/PDF; any patient last name not starting HACKDEMO-; screenshots from a run listing non-HACKDEMO patients."""
    run, referrals, steps, _ = rows
    problems, lines = [], []
    lasts = [r.get('patient_last') for r in referrals]
    lasts += [(r.get('extracted') or {}).get('last_name') for r in referrals]
    bad_names = sorted({str(n) for n in lasts if n and not str(n).startswith('HACKDEMO-')})
    missing = [r['referral'] for r in referrals if not r.get('patient_last')]
    all_hack = not bad_names and not missing and len(referrals) > 0
    if bad_names:
        problems.append(f'non-HACKDEMO patient last name(s) in run: {bad_names}')
    if missing:
        problems.append(f'patient last name unknown for {missing} (cannot prove HACKDEMO)')
    lines.append(f'patients in run: {len(referrals)}; all last names start HACKDEMO-: {all_hack}')
    secret_vals = [v for v in secrets if v and len(v) >= 8]
    for rel, data, ctype, src in files:
        why = []
        if SESSIONISH.search(rel) or SESSIONISH.search(src):
            why.append('session/cookie/storageState file name')
        if ctype == 'image/png':
            if not PUBLISHABLE_PNG.search(rel):
                why.append('screenshot type not on the publish allowlist (may show other patients)')
            if not all_hack:
                why.append('screenshot from a run that is not HACKDEMO-only')
        else:
            text = pdf_text(data) if ctype == 'application/pdf' else data.decode('utf8', 'replace')
            if text is None:
                why.append('could not extract text to check')
            else:
                low = text.lower()
                for tok in FORBIDDEN:
                    if tok.lower() in low:
                        why.append(f'contains forbidden token "{tok}"')
                if any(v in text for v in secret_vals):
                    why.append('contains a literal key value')
                if '"cookies"' in text or '"origins"' in text and '"localStorage"' in text:
                    why.append('looks like a storageState JSON')
                if ctype == 'application/pdf':
                    m = re.search(r'RE:\s*Referral\s*-\s*(\S+)\s+(\S+)', text)
                    if 'HACKDEMO-' not in text or (m and not m.group(2).startswith('HACKDEMO-')):
                        why.append('PDF patient name is not HACKDEMO-')
        if why:
            problems.append(f'{rel}: ' + '; '.join(why))
    lines.append(f'files checked: {len(files)} ({sum(1 for f in files if f[2] == "image/png")} png, '
                 f'{sum(1 for f in files if f[2] == "application/pdf")} pdf, {sum(1 for f in files if f[2].startswith("text/"))} html)')
    lines.append('forbidden tokens checked: ' + ', '.join(FORBIDDEN) + f' + {len(secret_vals)} literal key value(s)')
    lines += ['FAIL ' + p for p in problems]
    lines.append('SAFETY CHECK: ' + ('PASS' if not problems else f'FAIL ({len(problems)} problem(s)) — nothing uploaded'))
    return not problems, lines


# ---------- main ----------
def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    dry = '--dry-run' in argv
    envf = DEFAULT_ENV
    if '--env' in argv:
        envf = Path(argv[argv.index('--env') + 1])
        args = [a for a in args if a != str(envf)]
    if len(args) != 1:
        print(__doc__)
        return 2
    b = load_bundle(args[0])
    env = load_env(envf)
    url, key = env.get('SUPABASE_URL'), env.get('SUPABASE_SERVICE_ROLE_KEY')
    log(f'supabase-sync {b["dir"]} | SUPABASE_URL {"present" if url else "absent"} | SUPABASE_SERVICE_ROLE_KEY {"present" if key else "absent"}')
    rows = build_rows(b)
    if '--reviews-only' in argv:  # after Mary clicks Looks right / Something's wrong: write reviews rows, upload nothing
        if not (url and key):
            log('supabase-sync: keys absent — skipped'); return 0
        st, body = Supa(url, key).upsert('reviews', rows[3], 'run_id,referral')
        log(f'  upsert reviews: {len(rows[3])} row(s) ' + ('ok' if st < 300 else f'FAILED {st}: {body[:200].decode("utf8", "replace")}'))
        return 0 if st < 300 else 4
    files = collect_files(b, rows)
    secrets = [v for k, v in env.items() if any(t in k.upper() for t in ('KEY', 'TOKEN', 'SECRET', 'PASSWORD'))]
    ok, lines = safety_check(files, rows, secrets)
    for l in lines:
        log('  ' + l)
    if not ok:
        return 3
    if dry:
        log(f'dry run: would upsert 1 run, {len(rows[1])} referrals, {len(rows[2])} steps, {len(rows[3])} reviews; upload {len(files)} files')
        return 0
    if not (url and key):
        log('supabase-sync: keys absent — skipped (nothing uploaded, nothing written)')
        return 0
    s = Supa(url, key)
    prefix = f'{rows[0]["id"]}'
    s.ensure_bucket()
    failed = 0
    for rel, data, ctype, _ in files:
        st = s.upload(f'{prefix}/{rel}', data, ctype)
        if st >= 300:
            failed += 1
            log(f'  upload FAILED {st} {rel}')
    log(f'uploaded {len(files) - failed}/{len(files)} files to bucket {BUCKET}/{prefix}/')
    public = s.public_url(f'{prefix}/index.html')
    run, referrals, steps, reviews = build_rows(b, public)
    db_ok = True
    for table, data, oc in [('runs', [run], 'id'), ('referrals', referrals, 'run_id,referral'),
                            ('steps', steps, 'run_id,referral,step'), ('reviews', reviews, 'run_id,referral')]:
        st, body = s.upsert(table, data, oc)
        if st >= 300:
            db_ok = False
            log(f'  upsert {table} FAILED {st}: {body[:200].decode("utf8", "replace")}'
                + ('  → apply schema.sql in the Supabase SQL editor' if st in (404,) or b'PGRST205' in body or b'does not exist' in body else ''))
        else:
            log(f'  upsert {table}: {len(data)} row(s) ok')
    for table in ('runs', 'referrals', 'steps', 'reviews'):
        n_run, _ = s.count(table, f'&{"id" if table == "runs" else "run_id"}=eq.{urllib.parse.quote(run["id"])}')
        n_all, _ = s.count(table)
        log(f'  row count {table}: {n_run} for this run, {n_all} total')
    log(f'PUBLIC URL: {public}')
    return 0 if (db_ok and not failed) else 4


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
