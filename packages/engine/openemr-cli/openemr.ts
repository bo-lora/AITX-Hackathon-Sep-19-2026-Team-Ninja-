// openemr — standalone CLI that lets Mary's AI do REFERRAL FAX INTAKE on OpenEMR, with a fresh read-back after every write.
// Selectors and OpenEMR workarounds COPIED (not imported) from ../openemr-smoke/extras.js, smoke.js, NOTES.md and
// ../test-runner/oe-session.ts. Session: the auth-broker storageState file ($AUTH_SESSION_FILE). No password argument, ever.
//
// Exit codes: 0 = every write read back and matched | 1 = a read-back mismatch | 2 = logged out / login needed | 3 = other error
import { chromium, Browser, Page, Frame } from 'playwright';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const HACK = path.resolve(HERE, '..');
const SITES: Record<string, string> = { main: 'https://demo.openemr.io/openemr', a: 'https://demo.openemr.io/a/openemr', b: 'https://demo.openemr.io/b/openemr' };

// ---------- args
const argv = process.argv.slice(2);
const pos: string[] = []; const A: Record<string, string> = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const n = argv[i + 1]; if (n === undefined || n.startsWith('--')) A[k] = 'true'; else { A[k] = n; i++; } }
  else pos.push(a);
}
const JSON_ONLY = A.json === 'true';
const B = SITES[A.site || process.env.OPENEMR_SITE || 'a'] || A.site || process.env.OPENEMR_URL!;
const SESSION = path.resolve(process.env.AUTH_SESSION_FILE || path.join(HACK, 'automation-server/sessions/openemr.json'));
const AUTH = process.env.AUTH_BROKER || path.join(HACK, 'auth-broker/auth');
const EXTRACT = process.env.OPENEMR_EXTRACTOR || path.join(HACK, 'extract/extract');
const LOGIN_URL = B + '/interface/login/login.php';
const CHECK_URL = B + '/interface/main/finder/dynamic_finder.php';

const t0 = Date.now();
const log = (...a: any[]) => { if (!JSON_ONLY) console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a.map(x => typeof x === 'string' ? x : JSON.stringify(x))); };
class LoggedOut extends Error {}
class Mismatch extends Error { constructor(public field: string, public expected: string, public got: string, public step: string) { super(`${step}: ${field} expected ${JSON.stringify(expected)} got ${JSON.stringify(got)}`); } }
type Step = { step: string; status: 'VERIFIED' | 'MISMATCH' | 'ERROR' | 'SKIPPED'; detail: string; readback?: Record<string, string> };
const summary: any = { command: pos.slice(0, 2).join(' '), site: B, ok: false, exit_code: 3, steps: [] as Step[] };
const pad = (n: number) => String(n).padStart(2, '0');
const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();

function nextWeekday(): string { let t = new Date(Date.now() + 86400000); while ([0, 6].includes(t.getDay())) t = new Date(t.getTime() + 86400000); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; }
function resolveDate(s?: string) { if (!s || s === 'next-weekday') return nextWeekday(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; throw new Error('bad --date ' + s + ' (use YYYY-MM-DD or next-weekday)'); }
function hackLast(last?: string, suffix?: string) {
  if (!last) throw new Error('--last is required');
  const l = suffix && suffix !== 'true' ? `${last}-${suffix}` : last;
  if (!/^HACKDEMO-/.test(l)) throw new Error('refusing: last name must start with HACKDEMO- (shared public demo)');
  return l;
}
const US_STATES: Record<string, string> = { TX: 'Texas', CA: 'California', FL: 'Florida', NY: 'New York' };

// ---------- browser (headless, restored auth-broker session; pages are loaded top-level: main.php's token is single-use)
let browser: Browser; let page: Page; const dialogs: string[] = [];
async function open() {
  if (!fs.existsSync(SESSION)) throw new LoggedOut(`no session file at ${SESSION}; run: openemr login`);
  browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: SESSION, viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript({ path: path.join(HERE, 'shim.js') }); // no-op stubs for main.php's top-level helpers + tsx's __name
  page = await ctx.newPage();
  page.on('dialog', d => { dialogs.push(d.message()); log('JS dialog accepted:', JSON.stringify(d.message())); d.accept().catch(() => {}); });
  await go(CHECK_URL);
}
async function go(url: string) { // every read-back uses this: a fresh navigation, never the page state left by the write
  const r = await page.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(e => { if (/ERR_HTTP_RESPONSE_CODE_FAILURE/.test(e.message)) return null; throw e; });
  const st = r?.status() ?? 400;
  const body = norm(await page.locator('body').innerText().catch(() => ''));
  if ((st === 400 && !body) || st === 401 || await page.$('#authUser') || /login\.php/.test(page.url())) throw new LoggedOut(`session is logged out (HTTP ${st} at ${url.replace(B, '')}); run: openemr login`);
  if (/^Authentication Error/.test(body)) throw new Error(`site says "Authentication Error" at ${url.replace(B, '')}`);
  return page.mainFrame();
}
const text = async (f: Frame) => norm(await f.locator('body').evaluate(e => (e as HTMLElement).textContent || ''));

async function findPids(last: string): Promise<string[]> {
  const f = await go(`${B}/interface/main/finder/dynamic_finder.php?search_any=${encodeURIComponent(last)}`);
  await f.getByText(last).first().waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  return f.evaluate((l) => [...document.querySelectorAll('tr')].filter(r => (r.textContent || '').split(/[\s,]+/).includes(l))
    .map(r => ((r.id || '').match(/(\d+)/) || [])[1]).filter(Boolean) as string[], last);
}
async function pidFor(last: string): Promise<string> {
  if (A.pid) return A.pid;
  const ps = [...new Set(await findPids(last))];
  if (ps.length !== 1) throw new Error(`expected exactly 1 patient with last name ${last}, finder shows ${ps.length} (pids ${ps.join(',') || 'none'}); pass --pid`);
  return ps[0];
}
async function openChart(pid: string, last: string) { // sets the session's current patient and guards against the wrong chart
  const f = await go(`${B}/interface/patient_file/summary/demographics.php?set_pid=${pid}`);
  await page.waitForTimeout(1500);
  const t = await text(f); if (!t.includes(last)) throw new Error(`pid ${pid} is not ${last} (refusing to act)`);
  return { f, t };
}

// ---------- steps: each = write, then fresh read-back; throws Mismatch on a read-back difference
type Patient = { first: string; last: string; dob: string; sex: string; phone?: string; street?: string; city?: string; state?: string; zip?: string };
async function patientCreate(P: Patient): Promise<string> {
  const existing = await findPids(P.last);
  if (existing.length) throw new Error(`a patient named ${P.last} already exists (pid ${existing.join(',')}); refusing to create a duplicate (use --suffix)`);
  const f = await go(`${B}/interface/new/new.php`);
  await f.waitForSelector('#form_lname');
  await f.fill('#form_fname', P.first); await f.fill('#form_lname', P.last);
  await f.fill('#form_DOB', P.dob); await f.press('#form_DOB', 'Tab');
  await f.evaluate(() => document.querySelectorAll('.xdsoft_datetimepicker').forEach(e => ((e as HTMLElement).style.display = 'none')));
  await f.selectOption('#form_sex', P.sex);
  // contact fields sit in a collapsed section; set them in the DOM (they are plain inputs posted with the form)
  const set = await f.evaluate((v) => { const out: Record<string, string> = {};
    for (const [n, val] of Object.entries(v)) { if (!val) continue; const el = document.querySelector(`[name=${n}]`) as HTMLInputElement | HTMLSelectElement | null;
      if (!el) { out[n] = '(field not on form)'; continue; }
      if (el.tagName === 'SELECT') { const s = el as HTMLSelectElement; const o = [...s.options].find(o => o.value === val || o.text.trim() === val); if (o) s.value = o.value; }
      else el.value = val as string; el.dispatchEvent(new Event('change', { bubbles: true })); out[n] = el.value; }
    return out; }, { form_phone_home: P.phone, form_street: P.street, form_city: P.city, form_state: P.state, form_postal_code: P.zip });
  log('patient form filled:', P.first, P.last, P.dob, P.sex, set);
  // The Create button opens a duplicate-check popup whose Confirm calls srcConfirmSave() (smoke NOTES). The popup is flaky
  // (blank / no submit), so call srcConfirmSave() directly: the same function Confirm Create calls.
  await Promise.all([page.waitForNavigation({ timeout: 30000 }).catch(() => null), f.evaluate(() => (window as any).srcConfirmSave())]);
  await page.waitForTimeout(2500);
  let pid = (page.url().match(/(?:set_pid|pid)=(\d+)/) || [])[1];
  log('create submitted; landed on', page.url().replace(B, ''), '(save only, NOT a verification)');
  // READ-BACK (fresh loads): finder must list exactly this one patient, then the full demographics form must hold every field
  const pids = [...new Set(await findPids(P.last))];
  if (pids.length !== 1) throw new Mismatch('patient in finder', '1 match for ' + P.last, `${pids.length} matches`, 'patient create');
  pid = pids[0];
  await openChart(pid, P.last);
  const g = await go(`${B}/interface/patient_file/summary/demographics_full.php`);
  await g.waitForSelector('[name=form_lname]', { state: 'attached', timeout: 20000 });
  const rb: Record<string, string> = await g.evaluate(() => { const v = (n: string) => { const e = document.querySelector(`[name=${n}]`) as any; if (!e) return '(missing)'; return e.tagName === 'SELECT' ? (e.options[e.selectedIndex]?.text || '').trim() + '|' + e.value : e.value; };
    return { first: v('form_fname'), last: v('form_lname'), dob: v('form_DOB'), sex: v('form_sex'), phone: v('form_phone_home'), street: v('form_street'), city: v('form_city'), state: v('form_state'), zip: v('form_postal_code') }; });
  const exp: Record<string, string | undefined> = { first: P.first, last: P.last, dob: P.dob, sex: P.sex, phone: P.phone, street: P.street, city: P.city, state: P.state, zip: P.zip };
  for (const [k, e] of Object.entries(exp)) { if (!e) continue; const got = rb[k] || '';
    const lc = (x: string) => x.toLowerCase();
    const ok = got.split('|').some(x => lc(x) === lc(e) || lc(x) === lc(US_STATES[e] || '#'));
    if (!ok) throw new Mismatch(k, e, got, `patient create (pid ${pid})`); }
  summary.pid = pid;
  summary.steps.push({ step: 'patient create', status: 'VERIFIED', detail: `pid ${pid}; fresh load of demographics_full.php matches`, readback: rb });
  log('VERIFIED patient pid', pid, rb);
  return pid;
}

async function insuranceAdd(pid: string, last: string, I: { carrier: string; member: string; group?: string; first: string; dob: string; sex: string; street?: string; city?: string; state?: string; zip?: string }) {
  await openChart(pid, last);
  const f = await go(`${B}/interface/patient_file/summary/insurance_edit.php`); await f.waitForSelector('select[name=form_provider]', { state: 'attached', timeout: 30000 });
  const p = page;
  const hide = () => f.evaluate(() => document.querySelectorAll('.xdsoft_datetimepicker').forEach(e => ((e as HTMLElement).style.display = 'none')));
  const typed: [string, string][] = [];
  const typ = async (n: string, v?: string) => { if (!v) return; const l = f.locator(`[name=${n}]`).first(); typed.push([n, v]);
    for (let k = 0; k < 3; k++) { await l.focus(); await l.fill(''); await l.pressSequentially(v, { delay: 20 }); await l.press('Tab'); await hide();
      const got = await l.inputValue(); if (got.toLowerCase() === v.toLowerCase()) return; log(`${n} read ${JSON.stringify(got)} after typing; retyping`); } };
  const s2 = async (n: string, txt: string) => { const l = f.locator(`select[name=${n}]`).first();
    await l.locator('xpath=following-sibling::span[contains(@class,"select2")]').first().click(); await p.waitForTimeout(300);
    const re = new RegExp('^\\s*' + txt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|\\(|$)', 'i');
    await f.locator('.select2-results__option').filter({ hasText: re }).first().click(); await p.waitForTimeout(300);
    const v = await l.inputValue(); if (!v) throw new Error(`select2 ${n} did not take "${txt}"`); return v; };
  await s2('form_subscriber_relationship', 'Self'); await p.waitForTimeout(800); // FIRST: it rewrites the subscriber fields
  await typ('form_plan_name', `${I.carrier} plan`);
  await typ('form_date', '2026-01-01');
  await typ('form_policy_number', I.member); await typ('form_group_number', I.group);
  for (const [n, v] of [['form_subscriber_fname', I.first], ['form_subscriber_lname', last], ['form_subscriber_DOB', I.dob], ['form_subscriber_street', I.street], ['form_subscriber_city', I.city], ['form_subscriber_postal_code', I.zip]] as [string, string | undefined][]) await typ(n, v);
  await s2('form_subscriber_sex', I.sex);
  await s2('form_subscriber_state', US_STATES[I.state || 'TX'] || I.state || 'Texas');
  await s2('form_subscriber_country', 'USA');
  await s2('form_provider', I.carrier);
  { const de = f.locator('input[name=form_date_end]').first(); await de.focus(); await p.keyboard.press('ControlOrMeta+a'); await p.keyboard.press('Backspace');
    await de.evaluate(e => { (e as HTMLInputElement).value = ''; e.dispatchEvent(new Event('change', { bubbles: true })); }); await hide();
    await f.locator('[name=form_policy_number]').first().focus(); await hide(); }
  for (const [n, v] of [...typed]) { const got = await f.locator(`[name=${n}]`).first().inputValue(); if (got.toLowerCase() !== v.toLowerCase()) { log(`pre-save: ${n} reads ${JSON.stringify(got)}, retyping`); await typ(n, v); } }
  await f.locator('input.btn-save-policy:visible').first().click();
  await p.waitForTimeout(4000);
  const t = await text(f).catch(() => ''); const em = t.match(/One or more fields[^.]*\.[^.]*\./);
  if (em) { await f.getByText('Expand for more detailed errors').click({ timeout: 3000 }).catch(() => {}); const dt = await text(f); const k = dt.indexOf('Expand for more');
    throw new Error(`site rejected Save Policy, verbatim: "${em[0]}" Detailed: "${dt.slice(k + 31, k + 400).trim()}"`); }
  log('Save Policy clicked (save only, NOT a verification)');
  // READ-BACK: fresh load of insurance_edit.php
  await openChart(pid, last);
  const g = await go(`${B}/interface/patient_file/summary/insurance_edit.php`); await g.waitForSelector('input[name=form_policy_number]', { state: 'attached', timeout: 30000 });
  const rb: Record<string, string> = await g.evaluate(() => { const q = (n: string) => document.querySelector(`[name=${n}]`) as any;
    const sel = q('form_provider'); return { carrier: (sel?.options[sel.selectedIndex]?.text || '').trim(), member_id: q('form_policy_number')?.value || '', group: q('form_group_number')?.value || '', end_date: q('form_date_end')?.value || '', subscriber_last: q('form_subscriber_lname')?.value || '' }; });
  if (!rb.carrier.toLowerCase().startsWith(I.carrier.toLowerCase())) throw new Mismatch('insurance carrier', I.carrier, rb.carrier, 'insurance add');
  if (rb.member_id !== I.member) throw new Mismatch('insurance member id', I.member, rb.member_id, 'insurance add');
  if (I.group && rb.group !== I.group) throw new Mismatch('insurance group', I.group, rb.group, 'insurance add');
  if (rb.end_date) throw new Mismatch('insurance end date', '(empty)', rb.end_date, 'insurance add');
  summary.steps.push({ step: 'insurance add', status: 'VERIFIED', detail: 'fresh load of insurance_edit.php matches', readback: rb });
  log('VERIFIED insurance', rb);
}

async function docAttach(pid: string, last: string, file: string) {
  if (!fs.existsSync(file)) throw new Error('no such file ' + file);
  await openChart(pid, last);
  const lst = await go(`${B}/controller.php?document&list&patient_id=${pid}`); const lt = await text(lst);
  if (/Not Authorized/i.test(lt)) throw new Error('Documents page says "Documents Not Authorized" (log in as a user with Documents access, e.g. admin)');
  const cid = await lst.evaluate(() => { const a = [...document.querySelectorAll('a')].find(a => /Medical Record/.test(a.textContent || '')); return a ? ((a.getAttribute('href') || '') + (a.getAttribute('onclick') || '')).match(/parent_id=(\d+)/)?.[1] || '' : ''; }) || '3';
  const f = await go(`${B}/controller.php?document&upload&patient_id=${pid}&parent_id=${cid}`);
  await f.waitForSelector('#source-name', { state: 'attached', timeout: 20000 });
  if (!(await text(f)).includes(last)) throw new Error(`upload page is not for ${last} (refusing)`);
  await f.setInputFiles('#source-name', file);
  await Promise.all([page.waitForLoadState('load'), f.locator('input[type=submit][value=Upload]').first().click()]);
  await page.waitForTimeout(2500);
  log('upload submitted to Medical Record category', cid, '(save only, NOT a verification)');
  const g = await go(`${B}/controller.php?document&list&patient_id=${pid}`); await page.waitForTimeout(1500);
  const t = await text(g); const base = path.basename(file).replace(/\.pdf$/i, '');
  if (!t.includes(last)) throw new Mismatch('documents page patient', last, t.slice(0, 80), 'doc attach');
  const hit = t.match(new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(-\\d+)?\\.pdf`, 'i'));
  if (!hit) throw new Mismatch('document in list', path.basename(file), '(not in list) ' + t.slice(0, 160), 'doc attach');
  summary.steps.push({ step: 'doc attach', status: 'VERIFIED', detail: `fresh load of Documents list for pid ${pid} contains ${hit[0]}`, readback: { document: hit[0], category_id: cid } });
  log('VERIFIED document', hit[0]);
}

async function apptCreate(pid: string, last: string, ymd: string, hm: string, category: string) {
  await openChart(pid, last);
  const [hh, mm] = hm.split(':');
  const f = await go(`${B}/interface/main/calendar/add_edit_event.php?patientid=${pid}&date=${ymd.replace(/-/g, '')}&starttimeh=${+hh}&starttimem=${mm}`);
  await f.waitForSelector('#form_save', { timeout: 30000 });
  const cats = await f.$$eval('#form_category option', o => (o as HTMLOptionElement[]).map(x => ({ v: x.value, t: x.text.trim() })));
  const cat = cats.find(c => c.t.toLowerCase() === category.toLowerCase()) || cats.find(c => /office visit/i.test(c.t));
  if (!cat) throw new Error(`no appointment category "${category}"; available: ${cats.map(c => c.t).join(', ')}`);
  if (cat.t.toLowerCase() !== category.toLowerCase()) log(`category "${category}" not found; using "${cat.t}"`);
  await f.selectOption('#form_category', cat.v); await page.waitForTimeout(500);
  await f.fill('#form_date', ymd); await f.press('#form_date', 'Tab');
  await f.evaluate(() => document.querySelectorAll('.xdsoft_datetimepicker').forEach(e => ((e as HTMLElement).style.display = 'none')));
  const h = +hh; await f.fill('input[name=form_hour]', String(h > 12 ? h - 12 : h)); await f.fill('input[name=form_minute]', mm);
  if (await f.$('select[name=form_ampm]')) await f.selectOption('select[name=form_ampm]', h >= 12 ? '2' : '1').catch(() => {});
  const pname = await f.inputValue('#form_patient');
  if (!pname.includes(last)) throw new Error('appointment form patient field is ' + JSON.stringify(pname) + ', not ' + last);
  const prov = await f.$eval('#provd', s => { const x = s as HTMLSelectElement; return x.options[x.selectedIndex]?.text || ''; }).catch(() => '');
  await f.click('#form_save'); await page.waitForTimeout(5000);
  log('appointment save clicked:', ymd, hm, 'category', cat.t, 'provider', prov, '(save only, NOT a verification)');
  // READ-BACK: fresh dashboard load; the Future Appointments list must hold an entry with this date, time AND category
  await openChart(pid, last); await page.waitForTimeout(1500);
  const appts: { eid: string; category: string; when: string; who: string }[] = await page.mainFrame().evaluate(() =>
    [...document.querySelectorAll('.appts .list-group-item')].map(it => { const a = it.querySelector('a[onclick*=oldEvt]');
      if (!a) return null; const eid = ((a.getAttribute('onclick') || '').match(/,\s*(\d+)\)/) || [])[1] || '';
      const sm = it.querySelector('small'); const sp = it.querySelector('span');
      return { eid, category: (a.textContent || '').replace(/\s+/g, ' ').trim(), when: (sm?.textContent || '').replace(/\s+/g, ' ').trim(), who: (sp?.textContent || '').trim() }; }).filter(Boolean) as any);
  const hit = appts.find(x => x.when.includes(ymd) && x.when.includes(hm));
  if (!hit) throw new Mismatch('appointment on dashboard', `${ymd} ${hm}`, JSON.stringify(appts).slice(0, 300), 'appt create');
  if (hit.category.toLowerCase() !== cat.t.toLowerCase()) throw new Mismatch('appointment category', cat.t, hit.category, 'appt create');
  const around = `${hit.category} ${hit.when} ${hit.who} (eid ${hit.eid})`;
  summary.steps.push({ step: 'appt create', status: 'VERIFIED', detail: `fresh dashboard load shows "${around}"`, readback: { date: ymd, time: hm, category: hit.category, provider: hit.who, eid: hit.eid } });
  log('VERIFIED appointment:', around);
}

// ---------- extractor
function extract(pdf: string): any {
  if (A.stub === 'true') { // STUB: answer-key record, only for development before the extractor existed
    const recs = JSON.parse(fs.readFileSync(path.join(HACK, 'referrals/referrals.json'), 'utf8'));
    const r = recs.find((x: any) => x.file === path.basename(pdf)); if (!r) throw new Error('STUB: no record for ' + pdf);
    summary.extractor = 'STUB (referrals.json answer key)'; log('STUB extractor used (answer key, not real extraction)'); return r;
  }
  const r = spawnSync(EXTRACT, [pdf], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`extractor failed (exit ${r.status}): ${(r.stderr || '').slice(0, 300)}`);
  summary.extractor = EXTRACT; return JSON.parse(r.stdout);
}

// ---------- commands
const HELP = `openemr — referral fax intake on OpenEMR for Mary's AI (every write is read back on a fresh page load)

  openemr login                      open a visible window; Mary logs in herself (saves the session)
  openemr check                      LOGGED_IN (exit 0) or LOGGED_OUT (exit 2)
  openemr intake <referral.pdf> [--suffix TAG] [--date YYYY-MM-DD] [--time HH:MM]
                                     extract the PDF, then patient create + insurance add + doc attach + appt create
  openemr extract <referral.pdf>     print the extracted fields (no OpenEMR access)
  openemr patient create --first F --last HACKDEMO-X --dob YYYY-MM-DD --sex Male|Female [--phone --street --city --state TX --zip] [--suffix TAG]
  openemr insurance add --last HACKDEMO-X --carrier Aekna --member-id ID [--group G] [--first --dob --sex --street --city --state --zip] [--pid N]
  openemr doc attach --last HACKDEMO-X --file referral.pdf [--pid N]
  openemr appt create --last HACKDEMO-X [--date next-weekday|YYYY-MM-DD] [--time 10:00] [--category "New Patient"] [--pid N]

Options: --json (print only the final JSON line)  --site a|main|b (default a = https://demo.openemr.io/a/openemr)  --dry-run (print the plan; opens no browser, writes nothing)
Env: AUTH_SESSION_FILE (default <repo>/automation-server/sessions/openemr.json)
Exit: 0 all writes read back and matched | 1 read-back mismatch | 2 logged out, run: openemr login | 3 other error
Safety: only last names starting HACKDEMO- (shared public demo); never takes a password argument.`;

async function main(): Promise<number> {
  const [c1, c2] = pos;
  if (!c1 || c1 === 'help' || A.help) { console.log(HELP); return 0; }
  if (c1 === 'login') {
    const r = spawnSync(AUTH, ['login', LOGIN_URL, '--session', SESSION], { stdio: 'inherit' });
    summary.session_file = SESSION;
    if (r.status === 0) { summary.ok = true; return 0; } return r.status === 2 ? 2 : 3;
  }
  if (c1 === 'check') {
    const r = spawnSync(AUTH, ['check', CHECK_URL, '--session', SESSION], { encoding: 'utf8' });
    const out = (r.stdout || '').trim(); log(out || r.stderr); summary.session = out; summary.session_file = SESSION;
    if (r.status === 0) { summary.ok = true; return 0; } if (r.status === 1) return 2; return 3;
  }
  if (c1 === 'extract') { if (!c2) throw new Error('usage: openemr extract <pdf>'); const x = extract(path.resolve(c2)); summary.extracted = x; summary.ok = true; if (!JSON_ONLY) console.log(JSON.stringify(x, null, 2)); return 0; }

  const writeCmd = ['intake', 'patient', 'insurance', 'doc', 'appt'].includes(c1);
  if (!writeCmd) { console.error(HELP); return 3; }
  if (c1 === 'intake') {
    if (!c2) throw new Error('usage: openemr intake <referral.pdf>');
    const pdf = path.resolve(c2); const x = extract(pdf);
    const last = hackLast(x.last_name, A.suffix);
    const ymd = resolveDate(A.date); const hm = A.time || '10:00';
    summary.patient = { first: x.first_name, last, dob: x.dob }; summary.appointment = { date: ymd, time: hm, category: 'New Patient' };
    log(`extracted ${path.basename(pdf)} with ${summary.extractor}:`, x.first_name, x.last_name, x.dob, x.sex, x.insurance_carrier, x.member_id);
    if (A['dry-run'] === 'true') { summary.dry_run = true; summary.ok = true; log('DRY RUN: would create', last, 'and book', ymd, hm); return 0; }
    await open();
    const P: Patient = { first: x.first_name, last, dob: x.dob, sex: x.sex, phone: x.phone, street: x.address_street, city: x.address_city, state: x.address_state, zip: x.address_zip };
    const pid = await patientCreate(P);
    await insuranceAdd(pid, last, { carrier: x.insurance_carrier, member: x.member_id, group: x.group_number, first: x.first_name, dob: x.dob, sex: x.sex, street: x.address_street, city: x.address_city, state: x.address_state, zip: x.address_zip });
    await docAttach(pid, last, pdf);
    await apptCreate(pid, last, ymd, hm, A.category || 'New Patient');
  } else {
    const last = hackLast(A.last, A.suffix);
    if (A['dry-run'] === 'true') { summary.dry_run = true; summary.plan = { action: `${c1} ${c2}`, last, ...A }; summary.ok = true; log('DRY RUN: would run', `${c1} ${c2}`, 'for', last, '(nothing opened, nothing written)'); return 0; }
    await open();
    if (c1 === 'patient' && c2 === 'create') await patientCreate({ first: A.first, last, dob: A.dob, sex: A.sex, phone: A.phone, street: A.street, city: A.city, state: A.state, zip: A.zip });
    else {
      const pid = await pidFor(last); summary.pid = pid;
      if (c1 === 'insurance' && c2 === 'add') { if (!A.carrier || !A['member-id']) throw new Error('--carrier and --member-id are required');
        await insuranceAdd(pid, last, { carrier: A.carrier, member: A['member-id'], group: A.group, first: A.first || 'HACKDEMO', dob: A.dob || '1970-01-01', sex: A.sex || 'Female', street: A.street || '1 Demo St', city: A.city || 'Austin', state: A.state || 'TX', zip: A.zip || '78701' }); }
      else if (c1 === 'doc' && c2 === 'attach') { if (!A.file) throw new Error('--file is required'); await docAttach(pid, last, path.resolve(A.file)); }
      else if (c1 === 'appt' && c2 === 'create') await apptCreate(pid, last, resolveDate(A.date), A.time || '10:00', A.category || 'New Patient');
      else { console.error(HELP); return 3; }
    }
  }
  summary.ok = true; return 0;
}

(async () => {
  let code = 3;
  try { code = await main(); }
  catch (e: any) {
    if (e instanceof LoggedOut) { code = 2; summary.error = e.message; }
    else if (e instanceof Mismatch) { code = 1; summary.error = e.message; summary.mismatch = { step: e.step, field: e.field, expected: e.expected, got: e.got }; summary.steps.push({ step: e.step, status: 'MISMATCH', detail: e.message }); }
    else { code = 3; summary.error = String(e?.message || e).split('\n')[0]; }
    if (!JSON_ONLY) console.error('ERROR:', summary.error);
    if (page && A.shots) await page.screenshot({ path: path.resolve(A.shots, `fail-${Date.now()}.png`) }).catch(() => {});
  }
  if (page && A.shots && code === 0) await page.screenshot({ path: path.resolve(A.shots, `final-${Date.now()}.png`) }).catch(() => {});
  await browser?.close().catch(() => {});
  summary.exit_code = code; summary.dialogs = dialogs; summary.seconds = +((Date.now() - t0) / 1000).toFixed(1);
  console.log(JSON.stringify(summary));
  process.exit(code);
})();
