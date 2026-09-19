// recorder.ts — opens a HEADED browser already logged in (saved session), captures every click / field change /
// form submit / navigation Mary makes, in every frame, with a screenshot per click. Ends when she closes the window.
// Usage: tsx recorder.ts --session <file> --url <startUrl> --out <dir> [--login-url <loginUrl>]
// If the start page comes up blank or on the login page (OpenEMR's main.php token is single-use, so a restored cookie in a
// NEW browser process can land on a blank page — seen 11:45 CDT), the window is sent to --login-url and Mary logs in
// inside the recorder (her password is recorded only as [hidden]).
// REC_DRIVER=<module> (TEST ONLY) — default export async (page, {loginUrl}) drives the window, then the window is closed.
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const a = process.argv.slice(2);
const opt = (k: string, d = '') => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const session = opt('session'), url = opt('url'), out = opt('out'), loginUrl = opt('login-url');
fs.mkdirSync(path.join(out, 'shots'), { recursive: true });
const events: any[] = [];
const t0 = Date.now();
const save = () => fs.writeFileSync(path.join(out, 'events.json'), JSON.stringify({ start_url: url, started_at: new Date(t0).toISOString(), duration_seconds: Math.round((Date.now() - t0) / 100) / 10, events }, null, 2));

// Runs in every frame (OpenEMR renders its screens inside iframes). Passwords are never captured.
const PAGE_SCRIPT = `(() => {
  if (window.__recInstalled) return; window.__recInstalled = true;
  const esc = s => (window.CSS && CSS.escape) ? CSS.escape(s) : s;
  const labelOf = el => {
    if (el.id) { const l = document.querySelector('label[for="' + esc(el.id) + '"]'); if (l) return l.innerText.trim(); }
    const p = el.closest('label'); if (p) return p.innerText.trim();
    const td = el.closest('td'); const prev = td && td.previousElementSibling; if (prev) return prev.innerText.trim();
    return el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title') || '';
  };
  const selOf = el => {
    if (el.id) return '#' + esc(el.id);
    if (el.name) return el.tagName.toLowerCase() + '[name="' + el.name + '"]';
    const t = (el.innerText || el.value || '').trim().slice(0, 40);
    if (t && /^(A|BUTTON)$/.test(el.tagName)) return el.tagName.toLowerCase() + ':has-text("' + t + '")';
    const parts = []; let n = el;
    while (n && n.nodeType === 1 && parts.length < 5) { let s = n.tagName.toLowerCase(); const sib = n.parentElement ? [...n.parentElement.children].filter(c => c.tagName === n.tagName) : []; if (sib.length > 1) s += ':nth-of-type(' + (sib.indexOf(n) + 1) + ')'; parts.unshift(s); n = n.parentElement; }
    return parts.join(' > ');
  };
  const info = el => ({ tag: el.tagName.toLowerCase(), type: el.type || null, selector: selOf(el), label: labelOf(el).slice(0, 80), text: (el.innerText || '').trim().slice(0, 80), frame_url: location.href, frame_title: document.title });
  document.addEventListener('click', e => { const el = e.target.closest('a,button,input,select,label,[onclick],[role=button],li,td,span,div') || e.target; window.__rec && window.__rec({ kind: 'click', ...info(el) }); }, true);
  document.addEventListener('change', e => { const el = e.target; if (!el || !el.tagName) return; const secret = el.type === 'password';
    const value = secret ? '[hidden]' : el.tagName === 'SELECT' ? (el.options[el.selectedIndex] || {}).text : el.type === 'checkbox' || el.type === 'radio' ? String(el.checked) : el.type === 'file' ? [...(el.files || [])].map(f => f.name).join(', ') : el.value;
    window.__rec && window.__rec({ kind: 'fill', value, ...info(el) }); }, true);
  document.addEventListener('submit', e => { window.__rec && window.__rec({ kind: 'submit', ...info(e.target) }); }, true);
})();`;

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ storageState: session && fs.existsSync(session) ? session : undefined, viewport: { width: 1360, height: 860 } });
let n = 0;
await ctx.exposeBinding('__rec', async (src, ev) => {
  const e = { i: ++n, t: Math.round((Date.now() - t0) / 100) / 10, ...ev };
  if (e.kind === 'click') { const f = `shots/${String(n).padStart(3, '0')}.png`; try { await src.page.screenshot({ path: path.join(out, f) }); e.screenshot = f; } catch {} }
  events.push(e); save();
  console.log(`[rec] ${e.t}s ${e.kind} ${e.label || e.text || e.selector}${e.value !== undefined ? ' = ' + e.value : ''}`);
});
await ctx.addInitScript(PAGE_SCRIPT);
const page = await ctx.newPage();
page.on('framenavigated', f => { if (f === page.mainFrame()) { events.push({ i: ++n, t: Math.round((Date.now() - t0) / 100) / 10, kind: 'navigate', frame_url: f.url() }); save(); } });
const closed = new Promise<void>(res => { page.on('close', () => res()); browser.on('disconnected', () => res()); });
await page.goto(url).catch(e => console.log('[rec] start url failed to load:', String(e.message || e).split('\n')[0]));
await page.waitForTimeout(2500);
if (loginUrl && !/login/i.test(page.url())) {
  const blank = await page.evaluate(() => (document.body?.innerText || '').trim().length < 20 && document.querySelectorAll('iframe[src]').length === 0).catch(() => true);
  if (blank) { console.log('[rec] start page is blank (session not accepted in a new browser) → opening the login page'); events.push({ i: ++n, t: Math.round((Date.now() - t0) / 100) / 10, kind: 'note', text: 'start page blank; sent to login page' }); await page.goto(loginUrl).catch(() => {}); }
}
save();
console.log('RECORDING — close the browser window when finished.');
if (process.env.REC_DRIVER) { // TEST ONLY
  const mod = await import(path.resolve(process.env.REC_DRIVER));
  try { await mod.default(page, { loginUrl }); console.log('[rec] test driver finished'); }
  catch (e: any) { console.log('[rec] test driver error:', String(e?.message || e).split('\n')[0]); }
  await page.waitForTimeout(1000); save(); await browser.close().catch(() => {});
}
await closed;
save();
await browser.close().catch(() => {});
console.log(`RECORDED ${events.length} events → ${path.join(out, 'events.json')}`);
