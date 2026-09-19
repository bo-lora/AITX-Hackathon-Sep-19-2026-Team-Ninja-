// TEST ONLY — REC_DRIVER module for recorder.ts. Drives the headed recorder window like Mary would: log in (if the window
// is on the login page), Patient > New/Search, create HACKDEMO-REC-<HHMMSS>. Uses real clicks and typed keys so the
// recorder sees native click/change events. Creds come from TEST_LOGIN_USER / TEST_LOGIN_PASS (public demo creds),
// never logged. Selectors copied from openemr-smoke/smoke.js.
import type { Page, Frame } from 'playwright';

const pad = (n: number) => String(n).padStart(2, '0');
const d = new Date();
export const LNAME = process.env.REC_LNAME || `HACKDEMO-REC-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

async function typeInto(f: Page | Frame, sel: string, text: string) {
  await f.click(sel);
  await f.locator(sel).pressSequentially(text, { delay: 20 });
  await f.press(sel, 'Tab'); // blur → native change event
}
async function frameBy(p: Page, re: RegExp, tries = 60) {
  for (let i = 0; i < tries; i++) { const f = p.frames().find(x => re.test(x.url())); if (f) return f; await p.waitForTimeout(250); }
  throw new Error('frame not found: ' + re + ' frames=' + p.frames().map(f => f.url().slice(0, 70)).join(','));
}

export default async function (p: Page, o: { loginUrl?: string }) {
  console.log('[driver] patient', LNAME);
  if (/login/i.test(p.url()) || await p.$('#authUser')) {
    const u = process.env.TEST_LOGIN_USER, pw = process.env.TEST_LOGIN_PASS;
    if (!u || !pw) throw new Error('on login page and no TEST_LOGIN_USER/PASS set');
    await typeInto(p, '#authUser', u);
    await typeInto(p, '#clearPass', pw);
    await Promise.all([p.waitForURL(/main\.php/, { timeout: 30000 }), p.click('#login-button')]);
    await p.waitForLoadState('networkidle').catch(() => {});
    console.log('[driver] logged in inside recorder window');
  }
  await p.getByText('Patient', { exact: true }).first().click();
  await p.getByText('New/Search', { exact: true }).first().click();
  const fr = await frameBy(p, /interface\/new\/new\.php/);
  await fr.waitForSelector('#form_lname');
  await typeInto(fr, '#form_fname', 'Rec');
  await typeInto(fr, '#form_lname', LNAME);
  await typeInto(fr, '#form_DOB', '1970-01-01');
  await fr.click('#form_sex'); await fr.selectOption('#form_sex', 'Female');
  await fr.click('#create');
  const pop = await frameBy(p, /new_search_popup\.php/, 60);
  await pop.waitForSelector('#confirmCreate');
  await pop.click('#confirmCreate');
  await frameBy(p, /patient_file\/summary\/demographics\.php/, 80).then(() => console.log('[driver] patient dashboard loaded'))
    .catch(e => console.log('[driver] dashboard not seen:', e.message.slice(0, 120)));
  await p.waitForTimeout(1500);
}
