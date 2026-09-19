// dev probe: why does insurance_edit.php stay on "Loading..." top-level?
import { chromium } from 'playwright';
const B='https://demo.openemr.io/openemr';
const b=await chromium.launch(); const c=await b.newContext({storageState:'test-sessions/dev.json'}); await c.addInitScript({path:'shim.js'}); const p=await c.newPage();
p.on('console',m=>{ console.log('CONSOLE',m.text().slice(0,200))}); p.on('requestfailed',q=>console.log('REQFAIL',q.url().slice(0,120))); p.on('response',q=>{if(/apis/.test(q.url()))console.log('API',q.status(),q.url().slice(0,140))}); p.on('pageerror',e=>console.log('PAGEERR',e.message.slice(0,200)));
await p.goto(B+'/interface/patient_file/summary/demographics.php?set_pid=54'); await p.waitForTimeout(1500);
const r=await p.goto(B+'/interface/patient_file/summary/insurance_edit.php'); await p.waitForTimeout(6000);
console.log('status',r?.status(), 'selects', await p.locator('select').count(), 'provider', await p.locator('select[name=form_provider]').count());
console.log(await p.$$eval('select',s=>s.map(x=>x.name||x.id))); console.log((await p.locator('body').innerText()).slice(0,600)); console.log(await p.$$eval('script:not([src])',s=>s.map(x=>x.textContent).join('\n').slice(0,2500)));
await p.screenshot({path:'evidence/dev/probe-ins.png'}); await b.close();
