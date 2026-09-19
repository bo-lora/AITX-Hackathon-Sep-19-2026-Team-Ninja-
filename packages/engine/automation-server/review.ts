// review.ts — builds Mary's review page (review.html) for one /intake batch: one card per referral with the input PDF,
// extracted fields, clickable OpenEMR links to each output record, expected-vs-got read-back values, and triage flags.
const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);

export function outputLinks(B: string, pid?: string, eid?: string) {
  if (!pid) return [];
  const L = [
    { key: 'chart', label: 'Patient chart', url: `${B}/interface/patient_file/summary/demographics.php?set_pid=${pid}` },
    // insurance_edit.php stays on 'Loading…' outside the tabbed main screen (seen 12:49 CDT), so link the chart, which shows the insurance card
    { key: 'insurance', label: 'Insurance (shown on the patient chart)', url: `${B}/interface/patient_file/summary/demographics.php?set_pid=${pid}` },
    { key: 'documents', label: 'Documents: open the Medical Record folder', url: `${B}/controller.php?document&list&patient_id=${pid}` },
  ];
  if (eid) L.push({ key: 'appointment', label: 'Appointment', url: `${B}/interface/main/calendar/add_edit_event.php?eid=${eid}` });
  return L;
}

// expected (extracted from the PDF) vs got (read back from OpenEMR after the write)
function compareRows(x: any, cli: any) {
  const st = (n: string) => (cli?.steps || []).find((s: any) => s.step === n)?.readback || {};
  const p = st('patient create'), i = st('insurance add'), d = st('doc attach'), a = st('appt create');
  const rows: [string, any, any][] = [
    ['First name', x.first_name, p.first], ['Last name', x.last_name, p.last], ['DOB', x.dob, p.dob], ['Sex', x.sex, p.sex],
    ['Phone', x.phone, p.phone], ['Street', x.address_street, p.street], ['City', x.address_city, p.city], ['ZIP', x.address_zip, p.zip],
    ['Insurance', x.insurance_carrier, i.carrier], ['Member ID', x.member_id, i.member_id], ['Group', x.group_number, i.group],
    ['Document', cli?.command?.split('/').pop(), d.document], ['Appointment', 'New Patient, next weekday', a.date ? `${a.category} ${a.date} ${a.time} (${a.provider})` : undefined],
  ];
  const norm = (v: any) => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  return rows.map(([f, e, g]) => {
    let ok = g !== undefined && g !== '' && (norm(g).startsWith(norm(e)) || norm(g).includes(norm(e)) || String(g).split('|').some(v => norm(v) === norm(e)));
    if (f === 'Last name' && g) ok = norm(g).startsWith(norm(e)); // suffix -TAG is added on purpose
    if (f === 'Appointment') ok = !!a.date;
    const shown = typeof g === 'string' && g.includes('|') ? g.split('|')[0] : g; // read-back pairs like 'Male|Male', 'Texas|TX' → first value
    return { field: f, expected: e, got: shown, ok };
  });
}

export function buildReview(d: any): string {
  const refs: any[] = d.referrals || [];
  const needs = refs.filter(r => r.status === 'Needs Mary' || r.status?.startsWith('Hypothesis') || r.status?.startsWith('Not run'));
  const done = refs.filter(r => !needs.includes(r));
  const card = (r: any) => {
    const x = r.extracted || {}; const links = r.links || [];
    const cmp = r.cli ? compareRows(x, r.cli) : [];
    const cls = r.status?.startsWith('Confirmed') ? 'ok' : r.status === 'Needs Mary' ? 'hold' : 'warn';
    return `<section class="card ${cls}" id="${esc(r.file)}">
<header><h2>${esc(x.first_name)} ${esc(r.cli?.patient?.last || x.last_name)}</h2><span class="badge ${cls}">${esc(r.status)}</span>${r.seconds ? `<span class="secs">${r.seconds}s</span>` : ''}</header>
${(r.flags || []).length ? `<ul class="flags">${r.flags.map((f: any) => `<li><b>${esc(f.type)}</b> ${esc(f.reason)}</li>`).join('')}</ul>` : ''}
${r.reason ? `<p class="reason">${esc(r.reason)}</p>` : ''}
<div class="cols"><div><h3>Input</h3><p><a href="${esc(r.pdf_url)}" target="_blank">📄 ${esc(r.file)}</a></p>
<table>${['first_name', 'last_name', 'dob', 'sex', 'phone', 'address_street', 'address_city', 'address_zip', 'insurance_carrier', 'member_id', 'group_number', 'referring_provider', 'urgency'].filter(k => x[k] !== undefined).map(k => `<tr><th>${esc(k.replace(/_/g, ' '))}</th><td>${esc(x[k])}</td></tr>`).join('')}</table></div>
<div><h3>Outputs in OpenEMR</h3>${links.length ? `<ul class="links">${links.map((l: any) => `<li><a href="${esc(l.url)}" target="_blank">${esc(l.label)} ↗</a>${l.verified ? ` <span class="v">✓ opened ${esc(l.verified)}</span>` : ''}${l.shot ? ` · <a href="${esc(l.shot)}" target="_blank">screenshot</a>` : ''}</li>`).join('')}</ul>` : '<p>No records were created.</p>'}
<p class="how">How to find it in OpenEMR: search <b>${esc(r.cli?.patient?.last || x.last_name)}</b> in the top search box → Dashboard. (Links open in a browser that is logged in to OpenEMR.)</p>
${r.final_shot ? `<p><a href="${esc(r.final_shot)}" target="_blank"><img src="${esc(r.final_shot)}" alt="after screenshot"></a></p>` : ''}</div></div>
${cmp.length ? `<h3>Expected (from the PDF) vs got (read back from OpenEMR)</h3><table class="cmp"><tr><th>Field</th><th>Expected</th><th>Got</th><th></th></tr>${cmp.map(c => `<tr class="${c.ok ? '' : 'bad'}"><td>${esc(c.field)}</td><td>${esc(c.expected)}</td><td>${esc(c.got ?? '—')}</td><td>${c.ok ? '✓' : '?'}</td></tr>`).join('')}</table>` : ''}
${(r.cli?.steps || []).length ? `<p class="steps">${r.cli.steps.map((s: any) => `${esc(s.step)}: <b>${esc(s.status)}</b>`).join(' · ')}</p>` : ''}
<div class="mary" data-file="${esc(r.file)}"><button onclick="mark(this,'looks_right')">👍 Looks right</button> <button onclick="mark(this,'something_wrong')">⚠️ Something's wrong</button> <span class="saved"></span></div>
</section>`;
  };
  return `<!doctype html><meta charset="utf-8"><title>Mary's review — ${esc(d.intake_id)}</title>
<style>body{font:15px/1.45 -apple-system,system-ui,sans-serif;max-width:1100px;margin:24px auto;padding:0 16px;color:#1d2330;background:#f6f7f9}
h1{margin:0 0 4px}.sub{color:#667;margin-bottom:18px}.card{background:#fff;border-radius:10px;padding:16px 18px;margin:14px 0;border-left:6px solid #2e9d5b;box-shadow:0 1px 3px #0001}
.card.warn{border-color:#d99a00}.card.hold{border-color:#c0392b}header{display:flex;gap:12px;align-items:center}h2{margin:0;font-size:19px}
.badge{padding:2px 9px;border-radius:12px;font-size:13px;background:#e3f4ea}.badge.warn{background:#fff3cd}.badge.hold{background:#f8d7da}.secs{color:#889;font-size:13px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}table{border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:2px 8px 2px 0;vertical-align:top}th{color:#667;font-weight:500}
.cmp td,.cmp th{border-bottom:1px solid #eee;padding:3px 10px 3px 0}.cmp tr.bad td{background:#fff3cd}.links li{margin:3px 0}.v{color:#2e9d5b;font-size:12px}.how{color:#667;font-size:12px}
img{max-width:100%;border:1px solid #ddd;border-radius:6px}.flags{background:#fdf2f2;padding:8px 8px 8px 26px;border-radius:6px;margin:8px 0}.reason{color:#8a5a00}.steps{font-size:12px;color:#556}
.section{margin-top:26px;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#667}.mary{margin-top:10px}.mary button{font-size:13px;margin-right:6px}.saved{color:#2e9d5b;font-size:12px}</style>
<h1>Mary's review</h1><div class="sub">${esc(d.site_url)} · batch ${esc(d.intake_id)} · ${refs.length} referral(s) · ${esc(d.summary || '')}</div>
${needs.length ? `<div class="section">Needs Mary (${needs.length})</div>${needs.map(card).join('')}` : ''}
<div class="section">Done (${done.length})</div>${done.map(card).join('')}
<script>async function mark(b,v){const d=b.parentElement;const r=await fetch('/review/${esc(d.intake_id)}/mark',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({file:d.dataset.file,verdict:v})}).catch(()=>null);d.querySelector('.saved').textContent=r&&r.ok?'saved: '+v.replace('_',' '):'not saved (server offline?)';}</script>`;
}
