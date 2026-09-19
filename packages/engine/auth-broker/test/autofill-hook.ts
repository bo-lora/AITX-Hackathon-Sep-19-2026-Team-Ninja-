/**
 * TEST-ONLY login hook (the real product never sets AUTH_LOGIN_HOOK: Mary types herself).
 * Types the PUBLIC OpenEMR demo credentials from env vars TEST_LOGIN_USER / TEST_LOGIN_PASS.
 * Never logs or writes the values. Screenshots are taken BEFORE any typing, so no field value is captured.
 */
import type { Page } from 'playwright';
import * as path from 'node:path';
import * as fs from 'node:fs';

export default async function (page: Page): Promise<void> {
  const shotDir = process.env.TEST_SCREENSHOT_DIR;
  const tag = process.env.TEST_SCREENSHOT_TAG ?? 'login';
  if (shotDir) {
    fs.mkdirSync(shotDir, { recursive: true });
    await page.waitForSelector('input[type="password"]', { timeout: 30000 });
    const f = path.join(shotDir, `${tag}-popup-login-window-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
    await page.screenshot({ path: f, fullPage: true });
    process.stderr.write(`[test-hook] screenshot of headed login window: ${f}\n`);
  }
  const user = process.env.TEST_LOGIN_USER, pass = process.env.TEST_LOGIN_PASS;
  if (!user || !pass) { process.stderr.write('[test-hook] no test creds set; waiting for a human\n'); return; }
  await page.waitForTimeout(1500); // keep the pop-up visible briefly for the demo
  await page.fill('#authUser', user);
  await page.fill('#clearPass', pass);
  await page.click('#login-button, button[type="submit"], input[type="submit"]').catch(async () => {
    await page.press('#clearPass', 'Enter');
  });
  process.stderr.write('[test-hook] submitted login form (values not logged)\n');
}
