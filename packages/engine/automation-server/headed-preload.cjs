// headed-preload.cjs — loaded with NODE_OPTIONS=--require ONLY for POST /intake {headed:true}. Makes every Playwright
// chromium.launch() in the child tool (openemr-cli, which shares auth-broker/node_modules) VISIBLE and slowed
// (HEADED_SLOWMO ms, default 300) without editing that tool: it patches the shared playwright-core chromium object.
try {
  const pw = require(require('path').resolve(__dirname, '../auth-broker/node_modules/playwright-core'));
  if (pw.chromium && !pw.chromium.__headedPatched) {
    const launch = pw.chromium.launch.bind(pw.chromium);
    pw.chromium.launch = (o = {}) => { console.error('[review] opening visible browser'); return launch({ ...o, headless: false, slowMo: +(process.env.HEADED_SLOWMO || 300) }); };
    pw.chromium.__headedPatched = true;
  }
} catch (e) { console.error('[headed-preload] not applied:', e.message); }
