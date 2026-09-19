// server.ts — local automation server the team's web app calls (http://localhost:4710).
// It wraps tools already built and tested today: auth-broker (login pop-up + re-login), recorder.ts (live click
// capture), and test-runner (runs the OpenEMR steps, marks ✓/?, writes report.html). Runs on the demo laptop because
// the login and recording windows need a screen.
import http from 'http';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { buildReview, outputLinks } from './review.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PORT = Number(process.env.PORT || 4710);
// Demo decision 12:35 CDT: the LIVE DEMO runs on the clean instance /a. Default site is 'a' for login/status/record/run/intake;
// /run and /intake accept {site: 'main'|'a'|'b'} to override. OE_SITE=main|a|b changes the default at start.
const SITES: Record<string, string> = { main: 'https://demo.openemr.io/openemr', a: 'https://demo.openemr.io/a/openemr', b: 'https://demo.openemr.io/b/openemr' };
const DEFAULT_SITE = process.env.OE_SITE && SITES[process.env.OE_SITE] ? process.env.OE_SITE : 'a';
const SITE = process.env.OE_SITE_URL || SITES[DEFAULT_SITE];
const pickSite = (s?: string) => { const k = s || DEFAULT_SITE; if (!SITES[k]) throw new Error(`unknown site "${k}" (use main | a | b)`); return k; };
const LOGIN_URL = `${SITE}/interface/login/login.php`;
const CHECK_URL = `${SITE}/interface/main/finder/dynamic_finder.php`; // see auth-broker README: NOT tabs/main.php
const SESS_DIR = process.env.SESSION_DIR || path.join(HERE, 'sessions');
// one saved login PER SITE (a Main session is not valid on /a): sessions/openemr-<site>.json
const sessionFor = (site: string) => path.join(SESS_DIR, `openemr-${site}.json`);
const loginUrlFor = (site: string) => `${SITES[site]}/interface/login/login.php`;
const checkUrlFor = (site: string) => `${SITES[site]}/interface/main/finder/dynamic_finder.php`;
const SESSION = sessionFor(DEFAULT_SITE);
const AUTH = path.join(ROOT, 'auth-broker', 'auth');
const TSX = path.join(ROOT, 'auth-broker', 'node_modules', '.bin', 'tsx');
const RUNNER_DIR = path.join(ROOT, 'test-runner');
const RUNS_DIR = path.join(RUNNER_DIR, 'runs');
const REC_DIR = path.join(HERE, 'recordings');
fs.mkdirSync(path.dirname(SESSION), { recursive: true });
fs.mkdirSync(REC_DIR, { recursive: true });

let busy: string | null = null; // one browser job at a time — the demo site is shared and slow

function run(cmd: string, args: string[], cwd = HERE, env: Record<string, string> = {}): Promise<{ code: number; out: string; err: string }> {
  return new Promise(res => {
    const e: Record<string, string | undefined> = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0', ...env };
    for (const k of Object.keys(e)) if (e[k] === '') delete e[k]; // '' = unset (test-runner uses the default browser cache)
    const p = spawn(cmd, args, { cwd, env: e as any });
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; process.stdout.write(d); });
    p.stderr.on('data', d => { err += d; process.stderr.write(d); });
    p.on('close', code => res({ code: code ?? 1, out, err }));
  });
}
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
// newest sub-folder that actually contains the finished artifact (a run still in progress has no report.json yet)
const latest = (dir: string, must = '') => fs.existsSync(dir) ? fs.readdirSync(dir).filter(d => fs.statSync(path.join(dir, d)).isDirectory() && (!must || fs.existsSync(path.join(dir, d, must)))).sort().pop() : undefined;

async function body(req: http.IncomingMessage): Promise<any> {
  let s = ''; for await (const c of req) s += c;
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
}
function send(res: http.ServerResponse, code: number, data: any) {
  if (res.headersSent) return; // e.g. /intake {async:true} already answered 202
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(data, null, 2));
}
function serveFile(res: http.ServerResponse, file: string) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, { error: 'not found' });
  const ext = path.extname(file);
  const type = ({ '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.pdf': 'application/pdf' } as any)[ext] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, 'access-control-allow-origin': '*' });
  fs.createReadStream(file).pipe(res);
}
async function exclusive<T>(name: string, res: http.ServerResponse, fn: () => Promise<T>) {
  if (busy) return send(res, 409, { error: `busy: ${busy} is still running`, busy, retry: 'poll GET /health until busy is null' });
  busy = name;
  try { await fn(); } catch (e: any) { console.error(`[${name}] error:`, e?.message || e); send(res, 500, { error: String(e?.message || e) }); } finally { busy = null; } // an error in a job must not crash the server
}

async function status(site = DEFAULT_SITE) {
  const r = await run(AUTH, ['check', checkUrlFor(site), '--session', sessionFor(site)]);
  return r.code === 0 ? 'LOGGED_IN' : 'LOGGED_OUT';
}

process.on('unhandledRejection', e => console.error('[unhandledRejection]', e)); // belt and braces: never die mid-demo
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url || '/', `http://localhost:${PORT}`);
  const p = u.pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST', 'access-control-allow-headers': 'content-type' }); return res.end(); }
  try {
    if (p === '/' || p === '/health') return send(res, 200, { ok: true, site: SITE, default_site: DEFAULT_SITE, sites: SITES, busy, endpoints: ['POST /login', 'GET /status', 'POST /record', 'GET /recordings/latest', 'POST /run', 'GET /report/latest', 'GET /report/latest.json', 'POST /intake', 'GET /intake/latest', 'GET /review/latest', 'POST /review/<id>/mark'] });

    if (p === '/status' && req.method === 'GET') { const site = pickSite(u.searchParams.get('site') || undefined); return send(res, 200, { status: await status(site), site, site_url: SITES[site], session_file: path.basename(sessionFor(site)) }); }

    if (p === '/login' && req.method === 'POST') return exclusive('login', res, async () => {
      // Headed window pops up on this laptop; the human types their own credentials. Up to 5 minutes.
      const b = await body(req); const site = pickSite(b.site || u.searchParams.get('site') || undefined);
      console.log(`[review] opening visible browser (login for site ${site})`);
      const r = await run(AUTH, ['login', loginUrlFor(site), '--session', sessionFor(site)]);
      if (r.code !== 0) return send(res, 400, { status: 'LOGGED_OUT', site, error: (r.err || r.out).trim().split('\n').pop() });
      send(res, 200, { status: await status(site), site, site_url: SITES[site] });
    });

    if (p === '/record' && req.method === 'POST') return exclusive('record', res, async () => {
      const b = await body(req);
      const site = pickSite(b.site);
      if ((await status(site)) !== 'LOGGED_IN') {
        const l = await run(AUTH, ['login', loginUrlFor(site), '--session', sessionFor(site)]);
        if (l.code !== 0) return send(res, 400, { error: 'login failed or timed out; recording not started' });
      }
      const id = stamp(), out = path.join(REC_DIR, id);
      const start = b.url || `${SITES[site]}/interface/main/tabs/main.php`;
      const r = await run(TSX, [path.join(HERE, 'recorder.ts'), '--session', sessionFor(site), '--url', start, '--out', out, '--login-url', loginUrlFor(site)]);
      const f = path.join(out, 'events.json');
      if (!fs.existsSync(f)) return send(res, 500, { error: 'recorder produced no events file', detail: (r.err || '').slice(-800) });
      send(res, 200, { id, events_url: `/recordings/${id}/events.json`, ...JSON.parse(fs.readFileSync(f, 'utf8')) });
    });

    if (p === '/run' && req.method === 'POST') return exclusive('run', res, async () => {
      const b = await body(req);
      const site = pickSite(b.site);
      const src = b.commands_file || path.join(RUNNER_DIR, 'commands.referrals-3.json');
      // copy with target_url set to the site actually used, so the report header names the right instance
      const spec = JSON.parse(fs.readFileSync(src, 'utf8')); spec.target_url = SITES[site];
      const inDir = path.join(HERE, 'run-inputs'); fs.mkdirSync(inDir, { recursive: true });
      const file = path.join(inDir, `${stamp()}-${site}-${path.basename(src)}`); fs.writeFileSync(file, JSON.stringify(spec, null, 2));
      console.log(`[run] ${src} on site ${site} (${SITES[site]})`);
      const args = [path.join(RUNNER_DIR, 'run.ts'), file, '--site', site];
      const before = latest(RUNS_DIR, 'report.json');
      const r = await run(TSX, args, RUNNER_DIR, { PLAYWRIGHT_BROWSERS_PATH: '' });
      const after = latest(RUNS_DIR, 'report.json');
      if (!after || after === before) return send(res, 500, { error: 'runner produced no report', exit_code: r.code, detail: (r.err || r.out).slice(-800) });
      const report = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, after, 'report.json'), 'utf8'));
      send(res, 200, { run_id: after, exit_code: r.code, report_url: `/runs/${after}/report.html`, totals: report.totals, report });
    });

    if (p === '/intake' && req.method === 'POST') return exclusive('intake', res, async () => {
      // One-button batch via the openemr CLI (session only; NO password in any command). Per PDF:
      //   openemr intake <pdf> --site <s> [--suffix TAG] --json   (extract → patient → insurance → doc → appt, each read back)
      // Body: { pdfs?: [abs], dir?: abs, limit?, site? (default a), headed?: bool, suffix?, triage?: bool (default true), triage_live?: bool, async? }
      const b = await body(req); const t0 = Date.now(); const site = pickSite(b.site); const B = SITES[site]; const sess = sessionFor(site);
      const headed = !!b.headed;
      const id = stamp(), work = path.join(HERE, 'intake', id); fs.mkdirSync(path.join(work, 'pdfs'), { recursive: true });
      const log = (...m: any[]) => console.log(`[intake ${new Date().toLocaleTimeString('en-US', { hour12: false })}]`, ...m);
      const dir = b.dir || path.join(ROOT, 'referrals');
      let pdfs: string[] = Array.isArray(b.pdfs) && b.pdfs.length ? b.pdfs.map((x: string) => path.resolve(dir, x))
        : fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.pdf')).sort().map(f => path.join(dir, f));
      if (!pdfs.length) return send(res, 400, { error: 'no PDFs found', dir });
      // session for THIS site; headed → pop the login window (Mary types); otherwise refuse. Never built-in credentials.
      if ((await status(site)) !== 'LOGGED_IN') {
        if (!headed) return send(res, 401, { error: 'login needed', site, how: `POST /login {"site":"${site}"}` });
        log(`[review] opening visible browser (login for site ${site}) — Mary logs in`);
        const l = await run(AUTH, ['login', loginUrlFor(site), '--session', sess]);
        if (l.code !== 0 || (await status(site)) !== 'LOGGED_IN') return send(res, 401, { error: 'login needed', site, detail: 'login window closed or timed out' });
      }
      if (b.async) send(res, 202, { intake_id: id, site, referrals: pdfs.length, poll: 'GET /health until busy is null, then GET /review/latest', log: 'server.log' });
      log(`START ${pdfs.length} referral(s) on site ${site} (${B})${headed ? ' HEADED' : ''} → ${work}`);
      // triage (J): Urgent first; held referrals (missing/malformed field, exact duplicate) are NOT entered → 'Needs Mary'
      let tri: Record<string, any> = {};
      if (b.triage !== false) {
        const tj = path.join(work, 'triage.json'); const targs = ['--dir', path.dirname(pdfs[0]), '--out', tj, '--site', site]; if (!b.triage_live) targs.push('--offline');
        const tr = await run(path.join(ROOT, 'triage', 'triage'), targs, path.join(ROOT, 'triage'));
        try { for (const r of JSON.parse(fs.readFileSync(tj, 'utf8')).referrals || []) tri[r.file] = r; log(`triage: ${Object.keys(tri).length} referral(s) checked${b.triage_live ? '' : ' (offline: duplicate check NOT CHECKED)'}`); }
        catch { log('triage unavailable:', (tr.err || tr.out).trim().split('\n').pop()); }
        const rank = (f: string) => tri[path.basename(f)]?.urgency === 'Urgent' ? 0 : 1;
        pdfs = pdfs.map((f, i) => [f, i] as const).sort((x, y) => rank(x[0]) - rank(y[0]) || x[1] - y[1]).map(x => x[0]);
      }
      if (b.limit) pdfs = pdfs.slice(0, Number(b.limit));
      const cliEnv: Record<string, string> = { AUTH_SESSION_FILE: sess, PLAYWRIGHT_BROWSERS_PATH: '0' };
      if (headed) { cliEnv.NODE_OPTIONS = `--require ${path.join(HERE, 'headed-preload.cjs')}`; cliEnv.HEADED_SLOWMO = String(b.slowmo ?? 300); }
      const referrals: any[] = []; let stop = '';
      for (const [i, f] of pdfs.entries()) {
        const file = path.basename(f); fs.copyFileSync(f, path.join(work, 'pdfs', file));
        const ex = await run(path.join(ROOT, 'extract', 'extract'), [f], work); let x: any = {}; try { x = JSON.parse(ex.out); } catch {}
        const t = tri[file]; const flags = (t?.flags || []).filter((fl: any) => fl.type !== 'URGENT' || true);
        const r: any = { file, pdf_url: `/intake/${id}/pdfs/${file}`, extracted: x, flags, triage_decision: t?.decision };
        if (t && t.decision && t.decision !== 'READY') { r.status = 'Needs Mary'; r.reason = `Held by triage (${t.decision}); not entered.`; referrals.push(r); log(`${i + 1}/${pdfs.length} ${file} → Needs Mary (${t.decision})`); continue; }
        if (stop) { r.status = 'Not run'; r.reason = stop; referrals.push(r); continue; }
        log(`${i + 1}/${pdfs.length} ${file} → ${x.first_name} ${x.last_name}: entering in OpenEMR${headed ? ' ([review] opening visible browser)' : ''}…`);
        const shots = path.join(work, 'shots', file.replace(/\.pdf$/i, '')); fs.mkdirSync(shots, { recursive: true });
        const args = ['intake', f, '--site', site, '--json', '--shots', shots]; if (b.suffix) args.push('--suffix', String(b.suffix));
        const tc = Date.now(); const c = await run(path.join(ROOT, 'openemr-cli', 'openemr'), args, work, cliEnv);
        r.seconds = Math.round((Date.now() - tc) / 100) / 10; r.command = `openemr ${args.map(a => a.replace(ROOT + '/', '')).join(' ')}`;
        try { r.cli = JSON.parse(c.out.trim().split('\n').filter(l => l.startsWith('{')).pop() || '{}'); } catch { r.cli = null; }
        const shot = fs.existsSync(shots) ? fs.readdirSync(shots).filter(s => s.endsWith('.png')).sort().pop() : undefined;
        if (shot) r.final_shot = `/intake/${id}/shots/${path.basename(shots)}/${shot}`;
        const eid = r.cli?.steps?.find((s: any) => s.step === 'appt create')?.readback?.eid;
        r.links = outputLinks(B, r.cli?.pid, eid);
        if (c.code === 0) r.status = 'Confirmed ✓';
        else { r.status = 'Hypothesis ?'; r.reason = `openemr exit ${c.code}: ${(r.cli?.error || (c.err || c.out).trim().split('\n').pop() || '').slice(0, 300)}`; if (c.code === 2) stop = 'login needed (session expired) — POST /login, then re-run'; }
        referrals.push(r); log(`${r.status}  ${file}  pid ${r.cli?.pid ?? '-'}  ${r.seconds}s${r.reason ? '  ' + r.reason : ''}`);
      }
      const conf = referrals.filter(r => r.status?.startsWith('Confirmed')).length;
      const out = { intake_id: id, site, site_url: B, backend: 'openemr-cli (session only; no password in any command)', headed, wall_seconds: Math.round((Date.now() - t0) / 1000),
        summary: `${conf}/${referrals.length} confirmed · ${referrals.filter(r => r.status === 'Needs Mary').length} need Mary`, review_url: `/intake/${id}/review.html`, referrals };
      fs.writeFileSync(path.join(work, 'intake.json'), JSON.stringify(out, null, 2));
      fs.writeFileSync(path.join(work, 'review.html'), buildReview(out));
      log(`DONE ${out.summary} in ${out.wall_seconds}s | review http://localhost:${PORT}/review/latest`);
      if (!b.async) send(res, 200, out);
    });
    if (p === '/review/latest') { const l = latest(path.join(HERE, 'intake'), 'review.html'); if (!l) return send(res, 404, { error: 'no review yet' }); res.writeHead(302, { location: `/intake/${l}/review.html`, 'access-control-allow-origin': '*' }); return res.end(); }
    { const m = p.match(/^\/review\/([\w-]+)\/mark$/); if (m && req.method === 'POST') { // Mary's Looks right / Something's wrong → review.json
      const dirI = path.join(HERE, 'intake', m[1]); if (!fs.existsSync(dirI)) return send(res, 404, { error: 'no such intake' });
      const b = await body(req); const f = path.join(dirI, 'review.json'); const cur = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
      cur[String(b.file)] = { verdict: b.verdict, at: new Date().toISOString(), note: b.note }; fs.writeFileSync(f, JSON.stringify(cur, null, 2)); return send(res, 200, { ok: true, saved: cur[String(b.file)] }); } }
    if (p === '/intake/latest') { const l = latest(path.join(HERE, 'intake'), 'intake.json'); if (!l) return send(res, 404, { error: 'no intake yet' }); return serveFile(res, path.join(HERE, 'intake', l, 'intake.json')); }

    if (p === '/report/latest') { const l = latest(RUNS_DIR, 'report.html'); if (!l) return send(res, 404, { error: 'no runs yet' }); res.writeHead(302, { location: `/runs/${l}/report.html` }); return res.end(); }
    if (p === '/report/latest.json') { const l = latest(RUNS_DIR, 'report.json'); if (!l) return send(res, 404, { error: 'no runs yet' }); return serveFile(res, path.join(RUNS_DIR, l, 'report.json')); }
    if (p === '/recordings/latest') { const l = latest(REC_DIR, 'events.json'); if (!l) return send(res, 404, { error: 'no recordings yet' }); return serveFile(res, path.join(REC_DIR, l, 'events.json')); }

    // Static files for report pages, screenshots and recordings (path traversal blocked)
    for (const [prefix, dir] of [['/runs/', RUNS_DIR], ['/recordings/', REC_DIR], ['/intake/', path.join(HERE, 'intake')]] as const) {
      if (p.startsWith(prefix)) {
        const f = path.resolve(dir, decodeURIComponent(p.slice(prefix.length)));
        if (!f.startsWith(dir + path.sep)) return send(res, 403, { error: 'forbidden' });
        return serveFile(res, f);
      }
    }
    send(res, 404, { error: 'unknown endpoint' });
  } catch (e: any) { send(res, 500, { error: String(e?.message || e) }); }
});
server.listen(PORT, '127.0.0.1', () => console.log(`automation-server on http://localhost:${PORT} (site ${SITE})`));
