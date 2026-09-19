// oe-session.ts — holds ONE headless Playwright browser logged in to OpenEMR and exposes actions over a local HTTP port.
// Why a daemon: OpenEMR's main.php token is single-use and a restored cookie in a new browser process lands on a blank
// page (observed 11:45 CDT), so separate processes cannot share a session. The runner starts this in-process; each step's
// shell command (`npx tsx oe.ts <action> ...`) is a thin client that POSTs to it.
// Selectors copied (not imported) from <repo>/openemr-smoke/smoke.js (PASS x3 at 11:32-11:33 CDT).
import { chromium, Browser, Page, Frame } from 'playwright';
import * as http from 'http';

export const SITES: Record<string, string> = { main: 'https://demo.openemr.io/openemr', a: 'https://demo.openemr.io/a/openemr', b: 'https://demo.openemr.io/b/openemr' };
const pad = (n: number) => String(n).padStart(2, '0');
type Args = Record<string, string>;

export function resolveDate(s: string): string { // 'tomorrow' | 'today+N' | 'next-weekday' | YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s === 'next-weekday') { let t = new Date(Date.now() + 86400000); while ([0, 6].includes(t.getDay())) t = new Date(t.getTime() + 86400000); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; }
  const m = s.match(/^(?:today\+(\d+)|tomorrow)$/); if (!m) throw new Error('bad date ' + s);
  const t = new Date(Date.now() + (m[1] ? +m[1] : 1) * 86400000);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}
function requireLast(a: Args): string {
  const l = a.lname; if (!l) throw new Error('--lname required');
  if (!/^HACKDEMO-/.test(l)) throw new Error('refusing: last name must start with HACKDEMO- (shared public demo)');
  return l;
}
const text = async (f: Frame) => (await f.locator('body').innerText()).replace(/\s+/g, ' ');

export class OESession {
  b!: Browser; p!: Page; user = ''; B: string; pids: Record<string, string> = {}; dialogs: string[] = []; lines: string[] = []; t0 = Date.now();
  constructor(site = 'main') { this.B = SITES[site] || site; }
  log(...a: any[]) { const l = `[${((Date.now() - this.t0) / 1000).toFixed(1)}s] ` + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); this.lines.push(l); }
  async start() {
    this.b = await chromium.launch();
    const ctx = await this.b.newContext({ viewport: { width: 1400, height: 900 } });
    const onDialog = (d: any) => { this.dialogs.push(d.message()); this.log('JS DIALOG accepted:', d.message()); d.accept().catch(() => {}); };
    ctx.on('page', pg => pg.on('dialog', onDialog));
    this.p = await ctx.newPage();
    await this.p.goto('about:blank');
  }
  async assertPatient(fr: Frame, last: string) { // guard: never act on the wrong chart
    const t = (await fr.locator('body').evaluate(e => e.textContent || '')).replace(/\s+/g, ' ');
    const top = (await this.p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    if (!t.includes(last) && !top.includes(last)) throw new Error(`wrong patient in context: page does not show ${last} (refusing to act)`);
  }
  async clean() { // leftover OpenEMR modals (blank duplicate-check popup, "Available Appointments Calendar") block every click
    if (!/main\.php/.test(this.p.url())) return;
    const n = await this.p.evaluate(() => { const m = document.querySelectorAll('.modal, .modal-backdrop'); m.forEach(e => e.remove()); document.body.classList.remove('modal-open'); return m.length; }).catch(() => 0);
    if (n) this.log('removed', n, 'leftover modal element(s) before this step');
  }
  async stop() { await this.admin?.stop(); await this.b?.close().catch(() => {}); }
  async screenshot(path: string) { await this.p.screenshot({ path }); }
  async tabFrame(): Promise<Frame> { // pages must load inside a tab iframe; top-level loads return "Authentication Error" (smoke)
    if (!/main\.php/.test(this.p.url())) throw new Error('not logged in (run login first); page is ' + this.p.url().slice(0, 80));
    const p = this.p; let fr: Frame | undefined;
    // use the VISIBLE tab's iframe: elements inside a hidden tab cannot be clicked (observed 11:45 run: click timeouts)
    for (let i = 0; i < 40 && !fr; i++) {
      for (const f of p.mainFrame().childFrames()) {
        if (!/openemr/.test(f.url())) continue;
        const el = await f.frameElement().catch(() => null);
        if (el && await el.isVisible().catch(() => false)) { fr = f; break; }
      }
      if (!fr) await p.waitForTimeout(250);
    }
    if (!fr) throw new Error('no tab iframe in main.php; frames=' + p.frames().map(f => f.url().slice(0, 70)).join(','));
    return fr;
  }
  async findPid(fr: Frame, last: string): Promise<string> {
    if (this.pids[last]) return this.pids[last];
    await fr.goto(`${this.B}/interface/main/finder/dynamic_finder.php?search_any=${encodeURIComponent(last)}`);
    await fr.getByText(last).first().waitFor({ timeout: 20000 });
    const html = await fr.content(); const m = html.match(/pid[^0-9]{0,20}(\d+)/i);
    if (!m) throw new Error('could not find pid for ' + last);
    return m[1];
  }

  async login(a: Args) {
    const p = this.p;
    await p.goto(this.B + '/interface/login/login.php');
    this.user = a.user || 'receptionist';
    await p.fill('#authUser', a.user || 'receptionist'); await p.fill('#clearPass', a.pass || 'receptionist');
    await Promise.all([p.waitForURL(/main\.php/, { timeout: 30000 }), p.click('#login-button')]);
    await p.waitForLoadState('networkidle').catch(() => {});
    this.log('login submitted as', a.user || 'receptionist', 'at', this.B, '; landed on', p.url().replace(/<redacted> '<redacted>
  }
  async verifyLogin(_a: Args) { // fresh load of a tab page; a logged-out session renders the login form instead
    const fr = await this.tabFrame();
    await fr.goto(`${this.B}/interface/main/finder/dynamic_finder.php`);
    await fr.waitForLoadState('load'); await this.p.waitForTimeout(1500);
    if (await fr.$('#authUser')) throw new Error('fresh load of the patient finder showed the login form');
    const t = await text(fr); if (/Authentication Error/i.test(t)) throw new Error('fresh load shows "Authentication Error"');
    this.log('VERIFIED on fresh load: patient finder page renders for the logged-in session; reads:', t.slice(0, 100));
  }

  async createPatient(a: Args) {
    const last = requireLast(a); const p = this.p;
    await p.getByText('Patient', { exact: true }).first().click();
    await p.getByText('New/Search', { exact: true }).first().click();
    let fr: Frame | undefined;
    for (let i = 0; i < 40 && !fr; i++) { fr = p.frames().find(f => /interface\/new\/new\.php/.test(f.url())); if (!fr) await p.waitForTimeout(250); }
    if (!fr) throw new Error('new patient form (new.php) did not open');
    await fr.waitForSelector('#form_lname');
    await fr.fill('#form_fname', a.fname || 'HACKDEMO'); await fr.fill('#form_lname', last);
    await fr.fill('#form_DOB', a.dob || '1970-01-01'); await fr.press('#form_DOB', 'Tab');
    await fr.selectOption('#form_sex', a.sex || 'Female');
    const opt: [string, string][] = [['phone', '#form_phone_home'], ['street', '#form_street'], ['city', '#form_city'], ['zip', '#form_postal_code'], ['st', '#form_state']];
    if (opt.some(([k]) => a[k])) { // address/phone live in the collapsed "Contact" section
      const vis = await fr.locator('#form_street').isVisible().catch(() => false);
      if (!vis) await fr.getByText('Contact', { exact: true }).first().click({ timeout: 5000 }).catch(e => this.log('could not expand Contact section:', String(e.message).split('\n')[0]));
      await this.p.waitForTimeout(500);
    }
    const entered: string[] = [];
    for (const [k, sel] of opt) if (a[k]) {
      const el = fr.locator(sel);
      try {
        if (!(await el.count())) { this.log(`field ${sel} is not on the New Patient form; --${k} NOT entered`); continue; }
        const tag = await el.evaluate(e => e.tagName);
        if (tag === 'SELECT') await el.selectOption(a[k], { timeout: 5000 }).catch(async () => el.selectOption({ label: a[k] }, { timeout: 5000 }));
        else await el.fill(a[k], { timeout: 5000 });
        entered.push(`${k}=${a[k]}`);
      } catch (e: any) { this.log(`field ${sel}: could not enter --${k} (${String(e.message).split('\n')[0]}); NOT entered`); }
    }
    if (entered.length) this.log('contact fields entered on form:', entered.join(', '));
    const known = new Set(Object.values(this.pids));
    await fr.click('#create');
    let pop: Frame | undefined;
    for (let i = 0; i < 60 && !pop; i++) { pop = p.frames().find(f => /new_search_popup\.php/.test(f.url())); if (!pop) await p.waitForTimeout(250); if (i === 24 && !pop) { this.log('no duplicate-check popup after 6s; clicking Create again (smoke.js does the same)'); await fr.click('#create').catch(() => {}); } }
    if (!pop) throw new Error('duplicate-check popup (new_search_popup.php) never appeared');
    await pop.waitForSelector('#confirmCreate'); await pop.click('#confirmCreate');
    const findF = (re: RegExp) => p.frames().find(f => re.test(f.url()) && (!/demographics/.test(f.url()) || (/is_new=1/.test(f.url()) && !known.has((f.url().match(/set_pid=(\d+)/) || [])[1] || ''))));
    let demo: Frame | undefined;
    for (let i = 0; i < 24 && !demo; i++) { demo = findF(/patient_file\/summary\/demographics\.php/); if (!demo) await p.waitForTimeout(250); }
    if (!demo) { // smoke's documented flaky spot: popup sometimes never submits the parent form
      const nf = findF(/interface\/new\/new\.php/);
      if (nf) { this.log('FALLBACK: calling srcConfirmSave() (known flaky spot from smoke test)'); await nf.evaluate(() => (window as any).srcConfirmSave()).catch(e => this.log('fallback err', e.message)); }
      for (let i = 0; i < 80 && !demo; i++) { demo = findF(/patient_file\/summary\/demographics\.php/); if (!demo) await p.waitForTimeout(250); }
    }
    if (!demo) throw new Error('patient dashboard did not load after Confirm Create');
    await demo.waitForLoadState('load'); await p.waitForTimeout(1500);
    await p.evaluate(() => { document.querySelectorAll('.modal, .modal-backdrop').forEach(e => e.remove()); document.body.classList.remove('modal-open'); });
    let pid = (demo.url().match(/(?:set_pid|pid)=(\d+)/) || [])[1];
    if (!pid) pid = await demo.evaluate(() => { const m = document.documentElement.innerHTML.match(/pid['"]?\s*[:=]\s*['"]?(\d+)/); return m ? m[1] : ''; }).catch(() => '');
    if (!pid) throw new Error('could not determine pid from dashboard');
    this.pids[last] = pid; this.log('create submitted for', last, '; dashboard opened for pid', pid, '(save only — NOT a verification)');
  }
  async verifyPatient(a: Args) {
    const last = requireLast(a); const fr = await this.tabFrame();
    await fr.goto(`${this.B}/interface/main/finder/dynamic_finder.php?search_any=${encodeURIComponent(last)}`);
    await fr.getByText(last).first().waitFor({ timeout: 20000 });
    if (!(await text(fr)).includes(last)) throw new Error('finder did not list ' + last);
    const pid = await this.findPid(fr, last);
    await fr.goto(`${this.B}/interface/patient_file/summary/demographics.php?set_pid=${pid}`);
    await this.p.waitForTimeout(2500);
    const dt = await text(fr); const missing: string[] = []; const seen: string[] = [last];
    if (!dt.includes(last)) missing.push('last name');
    if (a.fname) (dt.includes(a.fname) ? seen : missing).push('first name ' + a.fname);
    if (a.dob) { const [y, m, d] = a.dob.split('-'); (dt.includes(a.dob) || dt.includes(`${m}/${d}/${y}`) ? seen : missing).push('DOB ' + a.dob); }
    const ck: [string, string][] = [['phone', 'form_phone_home'], ['street', 'form_street'], ['city', 'form_city'], ['zip', 'form_postal_code']];
    if (ck.some(([k]) => a[k])) { // contact fields are not on the dashboard; re-read them from a fresh load of the demographics edit form
      await fr.goto(`${this.B}/interface/patient_file/summary/demographics_full.php`); await fr.waitForLoadState('load'); await this.p.waitForTimeout(1000);
      const got: Record<string, string> = {};
      for (const [k, n] of ck) if (a[k]) { got[k] = await fr.locator(`[name=${n}]`).first().inputValue({ timeout: 5000 }).catch(() => '(field not found)'); const same = got[k].toLowerCase() === a[k].toLowerCase(); (same ? seen : missing).push(`${k} ${a[k]}${got[k] === a[k] ? '' : ' (stored as ' + JSON.stringify(got[k]) + ')'}`); }
      await fr.goto(`${this.B}/interface/patient_file/summary/demographics.php?set_pid=${pid}`); await this.p.waitForTimeout(1500); // leave the dashboard showing for the screenshot
    }
    if (missing.length) throw new Error(`dashboard for pid ${pid} (fresh load) is missing: ${missing.join(', ')}; seen: ${seen.join(' / ')}`);
    this.log('VERIFIED on fresh load: finder lists', last, '; dashboard pid', pid, 'shows', seen.join(' / '));
  }

  async bookAppt(a: Args) {
    const last = requireLast(a); const ymd = resolveDate(a.date || 'tomorrow'); const [hh, mm] = (a.time || '10:00').split(':');
    const fr = await this.tabFrame(); const pid = await this.findPid(fr, last);
    await fr.goto(`${this.B}/interface/main/calendar/add_edit_event.php?patientid=${pid}&date=${ymd.replace(/-/g, '')}&starttimeh=${+hh}&starttimem=${mm}`);
    await fr.waitForSelector('#form_save');
    const cats = await fr.$$eval('#form_category option', o => (o as HTMLOptionElement[]).map(x => ({ v: x.value, t: x.text.trim() })));
    const want = (a.category || 'New Patient').toLowerCase();
    const cat = cats.find(c => c.t.toLowerCase() === want) || cats.find(c => /new patient/i.test(c.t)) || cats.find(c => /office visit/i.test(c.t)) || cats[1];
    await fr.selectOption('#form_category', cat.v);
    await fr.fill('#form_date', ymd); await fr.press('#form_date', 'Tab');
    const h = +hh; await fr.fill('input[name=form_hour]', String(h > 12 ? h - 12 : h)); await fr.fill('input[name=form_minute]', mm);
    if (await fr.$('select[name=form_ampm]')) await fr.selectOption('select[name=form_ampm]', h >= 12 ? '2' : '1').catch(() => {});
    const pname = await fr.inputValue('#form_patient');
    if (!pname.includes(last)) throw new Error('appt form patient field is ' + JSON.stringify(pname) + ' not ' + last);
    const prov = await fr.$eval('#provd', s => { const x = s as HTMLSelectElement; return x.options[x.selectedIndex]?.text || ''; }).catch(() => '');
    await fr.click('#form_save'); await this.p.waitForTimeout(4000);
    this.log('appointment form saved: patient', pname, 'date', ymd, `${hh}:${mm}`, 'category', cat.t, 'provider', prov, '(save only — NOT a verification)');
  }
  async verifyAppt(a: Args) {
    const last = requireLast(a); const ymd = resolveDate(a.date || 'tomorrow'); const hm = a.time || '10:00';
    const fr = await this.tabFrame(); const pid = await this.findPid(fr, last);
    await fr.goto(`${this.B}/interface/patient_file/summary/demographics.php?set_pid=${pid}`);
    await this.p.waitForTimeout(2500);
    const dt = await text(fr); const [y, mo, d] = ymd.split('-');
    const m = dt.match(new RegExp(`(${ymd}|${mo}/${d}/${y}).{0,60}${hm}`));
    if (!m) { const i = dt.search(/Appointments/i); throw new Error(`appointment ${ymd} ${hm} NOT visible on fresh load of dashboard pid ${pid}; Appointments section reads: ${JSON.stringify(dt.slice(i, i + 200))}`); }
    this.log('VERIFIED on fresh load: dashboard pid', pid, 'shows', dt.slice(m.index!, m.index! + 90));
  }

  // Documents: receptionist gets "Documents Not Authorized" (openemr-smoke NOTES), so upload/read-back use a second
  // headless session logged in as admin/pass. Category parent_id=3 = "Medical Record" (from smoke NOTES).
  admin?: OESession;
  async adminFrame(): Promise<Frame> {
    if (this.user === 'admin') return this.tabFrame();
    if (!this.admin) { this.admin = new OESession(this.B); await this.admin.start(); await this.admin.login({ user: 'admin', pass: 'pass' }); this.log('opened second session as admin (receptionist is not authorized for Documents)'); }
    return this.admin.tabFrame();
  }
  async uploadDoc(a: Args) {
    const last = requireLast(a); if (!a.file) throw new Error('--file required');
    const fr = await this.adminFrame(); const pid = this.pids[last] || await this.findPid(fr, last);
    await fr.goto(`${this.B}/controller.php?document&upload&patient_id=${pid}&parent_id=${a.category || '3'}`);
    await fr.waitForSelector('#source-name', { state: 'attached', timeout: 20000 });
    await this.assertPatient(fr, last);
    await fr.setInputFiles('#source-name', a.file);
    await fr.locator('input[type=submit][value=Upload]').first().click();
    await fr.waitForLoadState('load'); await this.p.waitForTimeout(2000);
    this.log('upload submitted as admin: file', a.file.split('/').pop(), 'to pid', pid, 'category', a.category || '3', '(save only — NOT a verification)');
  }
  async verifyDoc(a: Args) {
    const last = requireLast(a); if (!a.file) throw new Error('--file required');
    const fr = await this.adminFrame(); const pid = this.pids[last] || await this.findPid(fr, last);
    await fr.goto(`${this.B}/controller.php?document&list&patient_id=${pid}`);
    await fr.waitForLoadState('load'); await this.p.waitForTimeout(2000);
    const t = (await fr.locator('body').evaluate(e => e.textContent || '')).replace(/\s+/g, ' '); const base = a.file.split('/').pop()!.replace(/\.pdf$/i, ''); // textContent includes collapsed tree nodes
    if (/Not Authorized/i.test(t)) throw new Error('document list says Not Authorized');
    if (!t.includes(last)) throw new Error(`Documents page for pid ${pid} does not show patient ${last}`);
    const hit = t.match(new RegExp(`(\\d{4}-\\d{2}-\\d{2} )?${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.pdf(-\\d+)?`));
    if (!hit) throw new Error(`fresh load of the Documents list for pid ${pid} does not contain "${base}"; list reads: ${JSON.stringify(t.slice(0, 200))}`);
    this.log('VERIFIED on fresh load: Documents list for pid', pid, 'contains', hit[0]);
  }
  async screenshotAdmin(path: string) { if (this.admin) await this.admin.p.screenshot({ path }); }
  // Insurance: approach copied from openemr-smoke/extras.js, which reported "NOT WORKING, READ-BACK FAIL" at ~12:00.
  // This makes the real attempt and surfaces the site's own validation text verbatim when it fails.
  async addInsurance(a: Args) {
    const last = requireLast(a); const fr = await this.tabFrame(); const pid = await this.findPid(fr, last);
    await fr.goto(`${this.B}/interface/patient_file/summary/demographics.php?set_pid=${pid}`); // sets the current patient
    await fr.waitForLoadState('load');
    await fr.goto(`${this.B}/interface/patient_file/summary/insurance_edit.php`); await fr.waitForSelector('select[name=form_provider]');
    await this.assertPatient(fr, last);
    // Sequence ported from openemr-smoke/extras.js (read-back-verified ~12:05): every dropdown is a select2 widget (click widget,
    // click option); text fields only register real key presses; Relationship=Self FIRST (it overwrites subscriber fields);
    // hide the date picker after each field; clear Effective Date End last (the picker can stamp today and end-date the policy).
    const p = this.p;
    const hide = () => fr.evaluate(() => document.querySelectorAll('.xdsoft_datetimepicker').forEach(e => ((e as HTMLElement).style.display = 'none')));
    const typed: [string, string][] = [];
    const typ = async (n: string, v?: string) => { if (!v) return; const l = fr.locator(`[name=${n}]`).first(); typed.push([n, v]);
      for (let k = 0; k < 3; k++) { // run 4 (11:58) lost a typed Effective Date / Policy Number once each; re-type until it reads back
        await l.focus(); await l.fill(''); await l.pressSequentially(v, { delay: 20 }); await l.press('Tab'); await hide();
        const got = await l.inputValue(); if (got.toLowerCase() === v.toLowerCase()) return; this.log(`${n} read ${JSON.stringify(got)} after typing; retyping`); } };
    const s2 = async (n: string, txt: string) => { const l = fr.locator(`select[name=${n}]`).first();
      await l.locator('xpath=following-sibling::span[contains(@class,"select2")]').first().click(); await p.waitForTimeout(300);
      await fr.locator('.select2-results__option', { hasText: txt }).first().click(); await p.waitForTimeout(300);
      const v = await l.inputValue(); if (!v) throw new Error(`select2 ${n} did not take "${txt}"`); return v; };
    await s2('form_subscriber_relationship', 'Self'); await p.waitForTimeout(800);
    await typ('form_date', a['eff-date'] || '2026-01-01');
    await typ('form_policy_number', a['member-id']); await typ('form_group_number', a.group);
    for (const [n, v] of [['form_subscriber_fname', a.fname], ['form_subscriber_lname', last], ['form_subscriber_DOB', a.dob], ['form_subscriber_street', a.street], ['form_subscriber_city', a.city], ['form_subscriber_postal_code', a.zip]] as [string, string | undefined][]) await typ(n, v);
    if (a.sex) await s2('form_subscriber_sex', a.sex);
    await s2('form_subscriber_state', a['st-label'] || (a.st === 'TX' ? 'Texas' : a.st || 'Texas'));
    await s2('form_subscriber_country', 'USA');
    const provV = await s2('form_provider', a.carrier || 'Aekna');
    const provT = await fr.$eval('select[name=form_provider]', s => { const x = s as HTMLSelectElement; return x.options[x.selectedIndex].text.trim(); });
    { const de = fr.locator('input[name=form_date_end]').first(); await de.focus(); await p.keyboard.press('ControlOrMeta+a'); await p.keyboard.press('Backspace');
      await de.evaluate(e => { (e as HTMLInputElement).value = ''; e.dispatchEvent(new Event('change', { bubbles: true })); }); await hide();
      await fr.locator('[name=form_policy_number]').first().focus(); await hide(); }
    const car = { t: provT, v: provV };
    for (const [n, v] of typed) { // final pre-save check of every typed field (Relationship/Provider widgets can rewrite fields)
      const got = await fr.locator(`[name=${n}]`).first().inputValue();
      if (got.toLowerCase() !== v.toLowerCase()) { this.log(`pre-save: ${n} reads ${JSON.stringify(got)}, retyping`); await typ(n, v); typed.pop(); }
    }
    this.log('insurance form filled via widgets: carrier', car.t, 'member', a['member-id'], 'group', a.group);
    await fr.locator('input.btn-save-policy:visible').first().click();
    await p.waitForTimeout(4000);
    const t = await text(fr).catch(() => '');
    const em = t.match(/One or more fields[^.]*\.[^.]*\./);
    if (em) {
      await fr.getByText('Expand for more detailed errors').click({ timeout: 3000 }).catch(() => {}); await this.p.waitForTimeout(500);
      const dt = await text(fr); const k = dt.indexOf('Expand for more');
      throw new Error(`site rejected Save Policy, verbatim: "${em[0]}" Detailed: "${dt.slice(k + 31, k + 400).trim()}"`);
    }
    this.log('Save Policy clicked for', car.t, 'member', a['member-id'], 'group', a.group, '— no validation error shown (save only — NOT a verification)');
  }
  async verifyInsurance(a: Args) {
    const last = requireLast(a); const fr = await this.tabFrame(); const pid = await this.findPid(fr, last);
    await fr.goto(`${this.B}/interface/patient_file/summary/demographics.php?set_pid=${pid}`); await this.p.waitForTimeout(2500);
    const dash = (await fr.locator('body').evaluate(e => e.textContent || '')).replace(/\s+/g, ' ');
    await fr.goto(`${this.B}/interface/patient_file/summary/insurance_edit.php`); await fr.waitForSelector('input[name=form_policy_number]');
    if (!dash.includes(last)) throw new Error(`dashboard for pid ${pid} does not show ${last}`);
    const vals = await fr.$$eval('input[name=form_policy_number],input[name=form_group_number]', o => (o as HTMLInputElement[]).map(x => x.value));
    const prov = await fr.$eval('select[name=form_provider]', s => { const x = s as HTMLSelectElement; return x.options[x.selectedIndex]?.text.trim() || ''; });
    const end = await fr.$eval('input[name=form_date_end]', e => (e as HTMLInputElement).value);
    const onDash = !!a['member-id'] && dash.includes(a['member-id']);
    const probs: string[] = [];
    if (!vals.includes(a['member-id'])) probs.push(`policy number reads ${JSON.stringify(vals[0] ?? '')}`);
    if (a.group && !vals.includes(a.group)) probs.push(`group number reads ${JSON.stringify(vals[1] ?? '')}`);
    if (a.carrier && !prov.toLowerCase().startsWith(a.carrier.toLowerCase())) probs.push(`provider reads ${JSON.stringify(prov)}`);
    if (end) probs.push(`Effective Date End is ${JSON.stringify(end)} (policy end-dated)`);
    if (probs.length) throw new Error(`fresh load of insurance_edit.php for pid ${pid}: ${probs.join('; ')}; dashboard contains ${a['member-id']}: ${onDash}`);
    this.log('VERIFIED on fresh load: insurance_edit.php shows provider', prov, '| policy/group', vals, '| end date empty | dashboard contains member id:', onDash);
  }

  actions(): Record<string, (a: Args) => Promise<void>> {
    return { login: a => this.login(a), 'verify-login': a => this.verifyLogin(a), 'create-patient': a => this.createPatient(a), 'verify-patient': a => this.verifyPatient(a), 'book-appt': a => this.bookAppt(a), 'verify-appt': a => this.verifyAppt(a),
      'upload-doc': a => this.uploadDoc(a), 'verify-doc': a => this.verifyDoc(a), 'add-insurance': a => this.addInsurance(a), 'verify-insurance': a => this.verifyInsurance(a) };
  }
  serve(): Promise<number> { // one request at a time; the runner runs steps sequentially
    const acts = this.actions();
    const srv = http.createServer((req, res) => {
      let body = ''; req.on('data', c => body += c); req.on('end', async () => {
        const name = (req.url || '/').slice(1); const f = acts[name]; this.lines = []; this.dialogs = [];
        let ok = true, error = '';
        if (!f) { ok = false; error = 'unknown action ' + name + '; known: ' + Object.keys(acts).join(', '); }
        else { try { await this.clean(); await f(JSON.parse(body || '{}')); } catch (e: any) { ok = false; error = String(e.message).split('\n')[0]; } }
        res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok, error, log: this.lines, dialogs: this.dialogs }));
      });
    });
    return new Promise(r => srv.listen(0, '127.0.0.1', () => r((srv.address() as any).port)));
  }
}
