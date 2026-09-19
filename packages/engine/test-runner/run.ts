#!/usr/bin/env -S npx tsx
// run.ts — executes commands.json against a live site, screenshots before/after each step, marks each step
// Confirmed ✓ (command exit 0 AND verify exit 0 after a fresh page load) or Hypothesis ? (with the reason),
// and writes runs/<timestamp>/report.json + report.html + shots/.
// Usage: npx tsx run.ts commands.json [--site main|a|b] [--out runs]
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { OESession } from './oe-session';

type Step = { id: string; bullet: string; command?: string; verify?: string; depends_on?: string[] | string };
type Item = { id: string; label?: string; vars?: Record<string, string>; steps: Step[]; extraction_check?: any };
type Cmds = { workflow: string; target_url: string; manual_seconds: number; manual_seconds_placeholder?: boolean; setup?: Step[]; steps?: Step[]; items?: Item[]; vars?: Record<string, string> };

const argv = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const cmdFile = argv.find(a => a.endsWith('.json')) || 'commands.json';
const pad = (n: number) => String(n).padStart(2, '0');
const now = new Date();
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const HHMMSS = stamp.slice(-6);
const tail = (s: string, n = 1500) => s.length > n ? '…' + s.slice(-n) : s;
const fmt = (s: number) => `${Math.floor(s / 60)}m ${pad(Math.round(s % 60))}s`;
const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
if (argv.includes('--rerender')) { // optional: rebuild report.html from an existing run's report.json (no site access)
  const dir = path.resolve(opt('rerender', '')); const r = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));
  setImmediate(() => { fs.writeFileSync(path.join(dir, 'report.html'), html(r)); console.log('re-rendered', path.join(dir, 'report.html')); process.exit(0); });
} else main();
function main() {
const OUT = path.resolve(opt('out', path.join(__dirname, 'runs')), stamp);
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });

function sh(command: string, env: Record<string, string>): Promise<{ code: number; out: string; err: string; secs: number }> {
  const t = Date.now();
  return new Promise(res => {
    const c = spawn(command, { shell: '/bin/bash', cwd: __dirname, env: { ...process.env, ...env } });
    let out = '', err = ''; c.stdout.on('data', d => out += d); c.stderr.on('data', d => err += d);
    c.on('close', code => res({ code: code ?? 1, out, err, secs: (Date.now() - t) / 1000 }));
  });
}
const subst = (s: string | undefined, v: Record<string, string>) => s?.replace(/\{\{(\w+)\}\}/g, (m, k) => k in v ? v[k] : m);

(async () => {
  const spec: Cmds = JSON.parse(fs.readFileSync(cmdFile, 'utf8'));
  const items: Item[] = spec.items?.length ? spec.items : [{ id: 'item1', label: spec.workflow, steps: spec.steps || [] }];
  const site = opt('site', /\/a\/openemr/.test(spec.target_url) ? 'a' : /\/b\/openemr/.test(spec.target_url) ? 'b' : 'main');
  const oe = new OESession(site); await oe.start(); const port = await oe.serve();
  const started_at = new Date().toISOString(); const tWall = Date.now();
  console.log(`run ${stamp} → ${OUT}  (${items.length} item(s), site ${site})`);

  async function runStep(prefix: string, s: Step, vars: Record<string, string>, done: Record<string, any>) {
    const r: any = { id: s.id, bullet: subst(s.bullet, vars), command: subst(s.command, vars), verify: subst(s.verify, vars), status: 'Hypothesis ?', reason: '', seconds: 0, command_seconds: null, verify_seconds: null, exit_code: null, verify_exit_code: null, before_png: null, after_png: null, verify_png: null, stdout_tail: '', stderr_tail: '', verify_stdout_tail: '', verify_stderr_tail: '', error_text: '' };
    const deps = ([] as string[]).concat(s.depends_on || []);
    const bad = deps.find(d => !done[d] || done[d].exit_code !== 0);
    if (bad) { r.reason = `skipped: depends on ${bad}`; console.log(`  ${prefix}${s.id} ? ${r.reason}`); return r; }
    if (!r.command) { r.reason = 'not run: no command'; return r; }
    const shot = async (tag: string) => { const f = `shots/${prefix}${s.id}-${tag}.png`; try { await oe.screenshot(path.join(OUT, f)); return f; } catch { return null; } };
    const env = { OE_PORT: String(port) };
    r.before_png = await shot('before');
    const c = await sh(r.command, env);
    r.command_seconds = +c.secs.toFixed(1); r.exit_code = c.code; r.stdout_tail = tail(c.out); r.stderr_tail = tail(c.err);
    r.after_png = await shot('after');
    if (c.code !== 0) { r.reason = `command failed (exit ${c.code})`; r.error_text = c.err.trim() || c.out.trim(); }
    else if (!r.verify) r.reason = 'no verify command — ran, but nothing re-read the result';
    else {
      const v = await sh(r.verify, env);
      r.verify_seconds = +v.secs.toFixed(1); r.verify_exit_code = v.code; r.verify_stdout_tail = tail(v.out); r.verify_stderr_tail = tail(v.err);
      r.verify_png = await shot('verify');
      if (v.code === 0) { r.status = 'Confirmed ✓'; r.reason = 'command exit 0 and verify exit 0 after a fresh page load'; }
      else { r.reason = `verify failed (exit ${v.code})`; r.error_text = v.err.trim() || v.out.trim(); }
    }
    r.seconds = +((r.command_seconds || 0) + (r.verify_seconds || 0)).toFixed(1);
    console.log(`  ${prefix}${s.id} ${r.status} ${r.seconds}s — ${r.reason}${r.error_text ? ' — ' + r.error_text.split('\n')[0] : ''}`);
    done[s.id] = r; return r;
  }

  const baseVars = { HHMMSS, ...(spec.vars || {}) };
  const setupDone: Record<string, any> = {}; const setup: any[] = [];
  for (const s of spec.setup || []) setup.push(await runStep('setup-', s, baseVars, setupDone));
  const outItems: any[] = [];
  for (const it of items) {
    const vars: Record<string, string> = { ...baseVars, ITEM: it.id, ...(it.vars || {}) }; for (const k of Object.keys(vars)) vars[k] = subst(vars[k], vars)!;
    console.log(`item ${it.id} ${it.label || ''}`);
    const done: Record<string, any> = { ...setupDone }; const t = Date.now(); const steps: any[] = [];
    for (const s of it.steps) steps.push(await runStep(`${it.id}-`, s, vars, done));
    const conf = steps.filter(x => x.status === 'Confirmed ✓').length;
    outItems.push({ id: it.id, label: subst(it.label, vars) || it.id, vars, steps, confirmed: conf, total: steps.length, extraction_check: it.extraction_check,
      status: conf === steps.length ? 'Confirmed ✓' : 'Hypothesis ?', ai_seconds: +steps.reduce((a, x) => a + x.seconds, 0).toFixed(1), wall_seconds: +((Date.now() - t) / 1000).toFixed(1) });
  }
  const wall = +((Date.now() - tWall) / 1000).toFixed(1);
  await oe.stop();
  const all = [...setup, ...outItems.flatMap(i => i.steps)];
  const ai = +all.reduce((a, x) => a + x.seconds, 0).toFixed(1);
  const manual = spec.manual_seconds * items.length;
  const totals = { items: items.length, items_confirmed: outItems.filter(i => i.status === 'Confirmed ✓').length, steps: all.length, steps_confirmed: all.filter(x => x.status === 'Confirmed ✓').length, steps_hypothesis: all.filter(x => x.status !== 'Confirmed ✓').length,
    ai_seconds: ai, ai_wall_clock_seconds: wall, manual_seconds_per_item: spec.manual_seconds, manual_seconds: manual, manual_seconds_placeholder: spec.manual_seconds_placeholder !== false,
    saving_seconds: +(manual - wall).toFixed(1), headline: `Mary: ${fmt(manual)} · AI: ${fmt(wall)}` };
  const report = { workflow: spec.workflow, target_url: spec.target_url, commands_file: path.resolve(cmdFile), started_at, finished_at: new Date().toISOString(), setup, items: outItems, totals };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  fs.copyFileSync(cmdFile, path.join(OUT, 'commands.json'));
  fs.writeFileSync(path.join(OUT, 'report.html'), html(report));
  console.log(`\n${totals.headline}  | steps ✓ ${totals.steps_confirmed}/${totals.steps} | items ✓ ${totals.items_confirmed}/${totals.items}\n${OUT}/report.html`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
}

function stepHtml(s: any) {
  const ok = s.status === 'Confirmed ✓';
  const img = (f: string | null, cap: string) => f ? `<figure><a href="${esc(f)}"><img src="${esc(f)}" alt="${cap}"></a><figcaption>${cap}</figcaption></figure>` : '';
  const log = [s.stdout_tail, s.verify_stdout_tail].filter(Boolean).join('\n');
  return `<div class="step ${ok ? 'ok' : 'hyp'}"><div class="head"><span class="badge">${ok ? '✓ Confirmed' : '? Hypothesis'}</span><b>${esc(s.bullet)}</b><span class="secs">${s.seconds}s</span></div>
<div class="reason">${esc(s.reason)}</div>
<div class="shots">${img(s.before_png, 'before')}${img(s.after_png, 'after')}${img(s.verify_png, 'read-back (fresh load)')}</div>
${s.error_text ? `<pre class="err">${esc(s.error_text)}</pre>` : ''}
<details><summary>command, verify &amp; output</summary><pre>$ ${esc(s.command)}\n$ ${esc(s.verify || '(no verify)')}\n\n${esc(log)}</pre></details></div>`;
}
function exHtml(x: any) { // optional: how the values typed into OpenEMR compare with the referral answer key
  if (!x) return '';
  const ok = x.matched === x.total;
  return `<div class="step ${ok ? 'ok' : 'hyp'}"><div class="head"><span class="badge">${ok ? '✓' : '?'} Extraction</span><b>Values read from the PDF vs answer key: ${x.matched}/${x.total} fields match</b><span class="secs">source: ${esc(x.source)}</span></div>${x.mismatches?.length ? `<pre class="err">${esc(x.mismatches.map((m: any) => `${m.field}: extracted ${JSON.stringify(m.extracted)} · answer key ${JSON.stringify(m.expected)}`).join('\n'))}</pre>` : ''}</div>`;
}
function html(r: any) {
  const t = r.totals;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Test report — ${esc(r.workflow)}</title><style>
body{font:14px/1.45 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;margin:0;background:#f6f7f9;color:#1d2330}
.wrap{max-width:1100px;margin:0 auto;padding:24px}
.clock{display:flex;gap:16px;margin:12px 0 20px}.clock>div{flex:1;background:#fff;border-radius:10px;padding:16px 20px;box-shadow:0 1px 3px #0001}
.clock .n{font-size:34px;font-weight:700}.clock .ai .n{color:#11804a}.clock small{color:#667}
.item{background:#fff;border-radius:10px;margin:12px 0;box-shadow:0 1px 3px #0001}.item>summary{padding:12px 16px;cursor:pointer;font-weight:600}
.step{border-top:1px solid #eee;padding:10px 16px}.head{display:flex;gap:10px;align-items:center}.secs{margin-left:auto;color:#667}
.badge{font-size:12px;font-weight:700;padding:2px 8px;border-radius:10px}.ok .badge{background:#dff5e7;color:#11804a}.hyp .badge{background:#fff1d6;color:#8a5a00}
.reason{color:#667;font-size:12px;margin:2px 0 6px}.shots{display:flex;gap:10px}figure{margin:0}figure img{width:240px;border:1px solid #ddd;border-radius:4px}figcaption{font-size:11px;color:#667}
pre{white-space:pre-wrap;font-size:12px;background:#f3f4f6;padding:8px;border-radius:6px;max-height:260px;overflow:auto}pre.err{background:#fdecec;color:#8b1c1c}
.pill{display:inline-block;padding:1px 8px;border-radius:10px;font-size:12px;margin-left:8px}.pill.ok{background:#dff5e7;color:#11804a}.pill.hyp{background:#fff1d6;color:#8a5a00}
</style></head><body><div class="wrap">
<h1>${esc(r.workflow)}</h1><div style="color:#667">${esc(r.target_url)} · started ${esc(r.started_at)}</div>
<div class="clock"><div><small>Mary, by hand${t.manual_seconds_placeholder ? ' (PLACEHOLDER length)' : ''}</small><div class="n">${fmt(t.manual_seconds)}</div><small>${t.items} × ${fmt(t.manual_seconds_per_item)}</small></div>
<div class="ai"><small>AI, wall clock</small><div class="n">${fmt(t.ai_wall_clock_seconds)}</div><small>sum of steps ${t.ai_seconds}s</small></div>
<div><small>Checked by read-back</small><div class="n">${t.steps_confirmed}/${t.steps}</div><small>steps Confirmed ✓ · ${t.items_confirmed}/${t.items} items fully confirmed</small></div></div>
${r.setup.length ? `<details class="item" open><summary>Setup</summary>${r.setup.map(stepHtml).join('')}</details>` : ''}
${r.items.map((i: any) => `<details class="item" ${r.items.length <= 3 || i.status !== 'Confirmed ✓' ? 'open' : ''}><summary>${esc(i.label)} <span class="pill ${i.status === 'Confirmed ✓' ? 'ok' : 'hyp'}">${i.confirmed}/${i.total} ✓</span> <span style="color:#667;font-weight:400">${i.ai_seconds}s</span>${i.steps.filter((x: any) => x.status !== 'Confirmed ✓').map((x: any) => `<div style="font-weight:400;font-size:12px;color:#8a5a00;margin:2px 0 0 18px">? ${esc(x.bullet)} — ${esc(x.reason)}${x.error_text ? ': ' + esc(x.error_text.replace(/^ERROR in [\w-]+: /, '').slice(0, 160)) : ''}</div>`).join('')}</summary>${exHtml(i.extraction_check)}${i.steps.map(stepHtml).join('')}</details>`).join('')}
<p style="color:#667;font-size:12px">Confirmed ✓ = the step's command exited 0 AND its verify command exited 0 after re-reading the record on a fresh page load (never a save message). Hypothesis ? = anything else; the reason is shown on the step.</p>
</div></body></html>`;
}
