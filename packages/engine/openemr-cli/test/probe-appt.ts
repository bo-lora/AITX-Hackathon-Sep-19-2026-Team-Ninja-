import { chromium } from 'playwright';
const B='https://demo.openemr.io/openemr';
const b=await chromium.launch(); const c=await b.newContext({storageState:'test-sessions/dev.json'}); await c.addInitScript({path:'shim.js'}); const p=await c.newPage();
await p.goto(B+'/interface/patient_file/summary/demographics.php?set_pid=54'); await p.waitForTimeout(3000);
const h=await p.content(); const i=h.indexOf('2026-09-21'); console.log(h.slice(Math.max(0,i-900),i+300));
await b.close();
