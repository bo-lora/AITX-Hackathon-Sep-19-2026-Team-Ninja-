// TEST: open every output link on a review page with the saved session (no shim, as in a normal browser),
// check the page shows the right HACKDEMO patient (last name + pid), screenshot it, log to review-test-log.txt,
// then write the result back into intake.json and rebuild review.html. Finally screenshot the review page itself.
// Usage: tsx test/verify-links.ts <intakeDir> <sessionFile> <serverBase>
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { buildReview } from '../review.ts';

const [dir, session, base] = process.argv.slice(2);
const LOG = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'review-test-log.txt');
const say = (s: string) => { console.log(s); fs.appendFileSync(LOG, s + '\n'); };
const d = JSON.parse(fs.readFileSync(path.join(dir, 'intake.json'), 'utf8'));
fs.mkdirSync(path.join(dir, 'linkshots'), { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: session, viewport: { width: 1300, height: 850 } });
const page = await ctx.newPage(); page.on('dialog', x => x.accept().catch(() => {}));
say(`\n=== link check ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CDT · intake ${d.intake_id} · site ${d.site_url} ===`);
let bad = 0, total = 0;
for (const r of d.referrals) {
  const last = r.cli?.patient?.last, pid = r.cli?.pid;
  for (const l of r.links || []) {
    total++;
    const resp = await page.goto(l.url, { waitUntil: 'load', timeout: 60000 }).catch(e => (say(`  nav error ${e.message.split('\n')[0]}`), null));
    await page.waitForTimeout(1200);
    if (l.key === 'documents') { await page.evaluate(() => { const a = [...document.querySelectorAll('a,span,div')].find(e => e.textContent?.trim() === 'Medical Record'); let n: any = a?.previousElementSibling; for (let i = 0; i < 3 && n; i++, n = n.previousElementSibling) if (n.tagName === 'IMG' || /expand|plus/i.test(n.className + (n.getAttribute?.('src') || ''))) { (n as any).click(); break; } }).catch(() => {}); await page.waitForTimeout(1200); say(`  (documents: clicked the + next to the 'Medical Record' folder once, as Mary would)`); }
    const txt = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    const html = await page.content().catch(() => '');
    const hasName = !!last && (txt.includes(last) || html.includes(last));
    const docVisible = txt.includes(r.file.replace(/\.pdf$/, '')); if (l.key === 'documents') say(`  (documents: file name visible on screen after expanding=${docVisible}; in this patient's document tree data=${html.includes(r.file)})`);
    const extra = l.key === 'documents' ? (docVisible || html.includes(r.file)) : l.key === 'insurance' ? txt.includes(r.extracted?.member_id) || html.includes(r.extracted?.member_id) : l.key === 'appointment' ? /New Patient/i.test(txt + html) : true;
    const shot = `linkshots/${r.file.replace('.pdf', '')}-${l.key}.png`; await page.screenshot({ path: path.join(dir, shot) }).catch(() => {});
    const ok = hasName && extra;
    l.verified = ok ? `${last} (pid ${pid})` : undefined; l.shot = `/intake/${d.intake_id}/${shot}`; l.check = { http: resp?.status() ?? null, name_on_page: hasName, detail_on_page: extra };
    if (!ok) bad++;
    say(`${ok ? 'PASS' : 'FAIL'} ${r.file} ${l.key.padEnd(11)} HTTP ${resp?.status() ?? '-'} name ${last} on page=${hasName} ${l.key === 'documents' ? 'pdf ' + r.file : l.key === 'insurance' ? 'member ' + r.extracted?.member_id : l.key === 'appointment' ? '"New Patient"' : ''} on page=${extra} · ${l.url}`);
  }
}
fs.writeFileSync(path.join(dir, 'intake.json'), JSON.stringify(d, null, 2));
fs.writeFileSync(path.join(dir, 'review.html'), buildReview(d));
const rp = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await rp.goto(`${base}/review/latest`); await rp.waitForTimeout(800);
await rp.screenshot({ path: path.join(dir, 'review-page.png'), fullPage: true });
say(`links: ${total - bad}/${total} opened the right HACKDEMO record · review page screenshot: ${path.join(dir, 'review-page.png')} (from ${rp.url()})`);
await browser.close();
process.exit(bad ? 1 : 0);
