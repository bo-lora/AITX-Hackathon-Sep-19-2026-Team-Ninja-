/**
 * Small wrapped command for test (c): loads the OpenEMR main page headlessly using AUTH_SESSION_FILE,
 * exits 0 if logged in, 1 if it lands on the login page / sees a password field. Read-only; touches no records.
 */
import { chromium } from 'playwright';
import * as fs from 'node:fs';

// Patient Finder page: read-only, loads the list view only. (tabs/main.php without its token_main bounces to login.)
const MAIN = process.env.PROBE_URL ?? 'https://demo.openemr.io/openemr/interface/main/finder/dynamic_finder.php';
const sf = process.env.AUTH_SESSION_FILE;
if (!sf || !fs.existsSync(sf)) { console.log('PROBE: no AUTH_SESSION_FILE'); process.exit(1); }
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ storageState: sf });
  const page = await ctx.newPage();
  let resp = null as Awaited<ReturnType<typeof page.goto>>;
  try { resp = await page.goto(MAIN, { waitUntil: 'load', timeout: 60000 }); }
  catch (e: any) { console.log(`PROBE: navigation failed (${String(e?.message ?? e).split('\n')[0]}) -> FAIL (logged out)`); process.exit(1); }
  await page.waitForTimeout(1000);
  const url = page.url();
  const pw = await page.locator('input[type="password"]').count();
  const status = resp?.status() ?? 0;
  const loggedOut = /login/i.test(new URL(url).pathname) || pw > 0 || status >= 400;
  console.log(`PROBE: status=${status} url=${new URL(url).pathname} passwordFields=${pw} title=${JSON.stringify(await page.title())} -> ${loggedOut ? 'FAIL (logged out)' : 'OK (main page loaded)'}`);
  if (!loggedOut && process.env.TEST_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.TEST_SCREENSHOT_DIR}/c-probe-page-after-relogin.png` });
  }
  process.exitCode = loggedOut ? 1 : 0;
} finally { await browser.close(); }
