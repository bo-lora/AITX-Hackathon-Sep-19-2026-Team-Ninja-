// TEST-ONLY (never the product path): headless login with the PUBLIC demo admin account, saving the same kind of
// storageState file auth-broker saves, so development runs do not pop a window. Usage: tsx test/test-login-headless.ts <out.json>
import { chromium } from 'playwright';
const B = 'https://demo.openemr.io/openemr'; const out = process.argv[2];
const b = await chromium.launch(); const c = await b.newContext(); const p = await c.newPage();
await p.goto(B + '/interface/login/login.php'); await p.fill('#authUser', 'admin'); await p.fill('#clearPass', 'pass');
await Promise.all([p.waitForURL(/main\.php/, { timeout: 30000 }), p.click('#login-button')]); await p.waitForLoadState('load');
await c.storageState({ path: out }); await b.close(); console.log('test session saved', out);
