// READ-ONLY duplicate check against the live OpenEMR demo. Creates nothing, edits nothing.
// Logs in headless in its OWN fresh browser context (admin/pass, public demo creds), opens the
// Patient Finder with search_any=<last name>, and reads each result row (pid, name, DOB).
// stdin: JSON [{file,last_name,dob}]  stdout: JSON [{file,last_name,dob,status,pids,rows,searched_at,site}]
import { chromium } from 'playwright';
const SITES: Record<string, string> = { main: 'https://demo.openemr.io/openemr', a: 'https://demo.openemr.io/a/openemr', b: 'https://demo.openemr.io/b/openemr' };
const B = SITES[process.env.OPENEMR_SITE || 'main'] || process.env.OPENEMR_SITE!;
const iso = () => { const d = new Date(); const o = -d.getTimezoneOffset(); const p = (n: number) => String(Math.abs(n)).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${o >= 0 ? '+' : '-'}${p(Math.floor(Math.abs(o) / 60))}:${p(Math.abs(o) % 60)}`; };
function normDob(s: string): string { // finder shows YYYY-MM-DD or MM/DD/YYYY depending on globals
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${m[3]}-${m[1]}-${m[2]}`; return '';
}
(async () => {
  const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  let p = await ctx.newPage();
  p.on('dialog', d => d.dismiss().catch(() => {}));
  const out: any[] = [];
  try {
    await p.goto(B + '/interface/login/login.php', { timeout: 60000 });
    await p.fill('#authUser', process.env.OE_USER || 'admin'); await p.fill('#clearPass', process.env.OE_PASS || 'pass');
    await Promise.all([p.waitForURL(/main\.php/, { timeout: 60000 }), p.click('#login-button')]);
    await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    const lp = p; p = await ctx.newPage(); p.on('dialog', d => d.dismiss().catch(() => {})); // search in a separate tab; leave main.php alone
    void lp;
    for (const r of input) {
      const searched_at = iso();
      const url = `${B}/interface/main/finder/dynamic_finder.php?search_any=${encodeURIComponent(r.last_name)}`;
      await p.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(async e => { if (!/ERR_ABORTED/.test(e.message)) throw e; await p.waitForTimeout(1500); await p.goto(url, { waitUntil: 'load', timeout: 60000 }); });
      if (await p.$('#authUser')) throw new Error('logged out while searching');
      // wait for the ajax table to finish (processing indicator gone, then rows or "No matching")
      await p.waitForFunction(() => { const t = document.querySelector('#pt_table tbody'); return !!t && !/Loading|Processing/i.test(t.textContent || ''); }, null, { timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(1200);
      const headers: string[] = await p.$$eval('#pt_table thead th', ths => ths.map(t => (t.textContent || '').trim()));
      // show up to 100 rows per page so a paginated result cannot hide a match
      const lenSel = await p.$('select[name="pt_table_length"]');
      let page_len = '10 (default)';
      if (lenSel) { const opts: string[] = await lenSel.$$eval('option', os => os.map(o => (o as HTMLOptionElement).value));
        const best = opts.map(Number).filter(n => n > 0).sort((a, b) => b - a)[0];
        if (best) { await lenSel.selectOption(String(best)); await p.waitForTimeout(2500); page_len = String(best); } }
      const info = ((await p.textContent('#pt_table_info').catch(() => '')) || '').trim();
      const rows2: any[] = await p.$$eval('#pt_table tbody tr', trs => trs.map(tr => ({ id: tr.id || '', cells: [...tr.querySelectorAll('td')].map(td => (td.textContent || '').trim()) })));
      const dobIdx = headers.findIndex(h => /DOB|Birth/i.test(h));
      const all = rows2.filter(x => x.cells.length > 1).map(x => ({ pid: ((x.id.match(/(\d+)/) || [])[1]) || '', name: x.cells[0],
        lname: (x.cells[0].split(',')[0] || '').trim(), dob: normDob(dobIdx >= 0 ? x.cells[dobIdx] : x.cells.join(' ')), cells: x.cells }));
      const L = r.last_name.toLowerCase();
      const exact = all.filter(x => x.lname.toLowerCase() === L && x.dob === r.dob);
      const variant = all.filter(x => x.lname.toLowerCase().startsWith(L + '-') && x.dob === r.dob);
      out.push({ file: r.file, last_name: r.last_name, dob: r.dob, site: B, searched_at, search_url: url, page_len, table_info: info,
        status: exact.length ? 'FOUND' : variant.length ? 'POSSIBLE' : 'NOT FOUND',
        exact_matches: exact.map(x => ({ pid: x.pid, name: x.name, dob: x.dob })),
        variant_matches: variant.map(x => ({ pid: x.pid, name: x.name, dob: x.dob })),
        same_last_name_other_dob: all.filter(x => x.lname.toLowerCase() === L && x.dob !== r.dob).map(x => ({ pid: x.pid, name: x.name, dob: x.dob })),
        rows_seen: all.length });
    }
  } catch (e: any) {
    out.push({ error: String(e.message || e), at: iso() });
    console.log(JSON.stringify(out, null, 2)); await browser.close(); process.exit(1);
  }
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
