// Debug only: find which OpenEMR URL distinguishes logged-in from logged-out. Headless; public demo creds via env; not logged.
import { chromium } from 'playwright';
const base = 'https://demo.openemr.io/openemr/';
const cands = process.argv.slice(2);
const b = await chromium.launch({ headless: true });
for (const c of cands) {
  const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.goto(base + 'interface/login/login.php');
  await p.fill('#authUser', process.env.TEST_LOGIN_USER!); await p.fill('#clearPass', process.env.TEST_LOGIN_PASS!);
  await Promise.all([p.waitForURL(u => !/login\.php/.test(u.pathname), { timeout: 30000 }), p.click('#login-button')]);
  await p.waitForLoadState('load');
  const landing = new URL(p.url());
  const st = await ctx.storageState();
  const ctx2 = await b.newContext({ storageState: st }); const p2 = await ctx2.newPage();
  const r = await p2.goto(base + c, { waitUntil: 'load' }); await p2.waitForTimeout(1000);
  console.log(`cand=${c} landing=${landing.pathname}${landing.search ? '?<query keys: ' + [...landing.searchParams.keys()].join(',') + '>' : ''} -> status=${r?.status()} final=${new URL(p2.url()).pathname} pw=${await p2.locator('input[type=password]').count()} title=${JSON.stringify(await p2.title())}`);
  await ctx.close(); await ctx2.close();
}
await b.close();
