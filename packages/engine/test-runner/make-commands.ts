#!/usr/bin/env -S npx tsx
// make-commands.ts — builds a commands.json for REFERRAL FAX INTAKE from ../referrals/referrals.json (the answer key).
// Usage: npx tsx make-commands.ts [--limit N] [--manual-seconds 240] [--out commands.referrals.json]
// Last names get a per-run suffix (-TR<HHMMSS>) so every run creates NEW HACKDEMO- records and never collides with
// patients from other runs/agents on the shared demo.
import * as fs from 'fs'; import * as path from 'path';
const argv = process.argv.slice(2); const opt = (k: string, d: string) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
// --source <file.json>: values to ENTER (e.g. the PDF extractor's output); default is the answer key itself.
// --key <file.json>: answer key used only to SCORE the source (default ../referrals/referrals.json); matched by "file".
const KEY = path.resolve(__dirname, '../referrals/referrals.json');
const src = path.resolve(opt('source', KEY));
const keyFile = path.resolve(opt('key', KEY));
const raw = JSON.parse(fs.readFileSync(src, 'utf8')); const all: any[] = Array.isArray(raw) ? raw : (raw.referrals || raw.items || Object.values(raw));
const only = opt('only', ''); // optional: comma list of files, e.g. referral-03.pdf
const refs: any[] = all.filter(r => !only || only.split(',').includes(r.file)).slice(0, +opt('limit', '10'));
const key: any[] = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
const FIELDS = ['first_name', 'last_name', 'dob', 'sex', 'phone', 'address_street', 'address_city', 'address_state', 'address_zip', 'insurance_carrier', 'member_id', 'group_number'];
function check(r: any) {
  const k = key.find(x => x.file === r.file); if (!k) return { source: path.basename(src), matched: 0, total: 0, mismatches: [{ field: 'file', extracted: r.file, expected: '(not in answer key)' }] };
  const mism = FIELDS.filter(f => String(r[f] ?? '').trim() !== String(k[f] ?? '').trim()).map(f => ({ field: f, extracted: r[f] ?? null, expected: k[f] }));
  return { source: path.basename(src), key: path.basename(keyFile), matched: FIELDS.length - mism.length, total: FIELDS.length, mismatches: mism };
}
const q = (s: string) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const OE = 'npx tsx oe.ts';
const items = refs.map((r, i) => {
  const id = 'r' + String(i + 1).padStart(2, '0');
  const L = `${r.last_name}-TR{{HHMMSS}}`;
  const mins = 9 * 60 + 15 * i; const time = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`; // 09:00, 09:15, ... 11:15 (morning only: the dashboard shows 12-hour times without am/pm, so 13:00 reads as 01:00)
  const who = `--lname ${q(L)} --fname ${q(r.first_name)} --dob ${r.dob}`;
  return {
    id, label: `${r.file}: ${r.first_name} ${L} (${r.insurance_carrier})`,
    vars: { LNAME: L, PDF: path.resolve(__dirname, '../referrals', path.basename(r.file)) },
    extraction_check: src === keyFile ? undefined : check(r),
    steps: [
      { id: 'patient', bullet: `Create patient ${r.first_name} ${L}, DOB ${r.display_dob || r.dob}, ${r.sex}, phone ${r.phone}, ${r.address_street}, ${r.address_city} ${r.address_state} ${r.address_zip}`,
        command: `${OE} create-patient ${who} --sex ${r.sex} --phone ${q(r.phone)} --street ${q(r.address_street)} --city ${q(r.address_city)} --st ${q(r.address_state)} --zip ${q(r.address_zip)}`,
        verify: `${OE} verify-patient ${who} --phone ${q(r.phone)} --street ${q(r.address_street)} --city ${q(r.address_city)} --zip ${q(r.address_zip)}` },
      { id: 'insurance', bullet: `Add primary insurance ${r.insurance_carrier}, member ${r.member_id}, group ${r.group_number}`, depends_on: ['patient'],
        command: `${OE} add-insurance --lname ${q(L)} --carrier ${q(r.insurance_carrier)} --member-id ${q(r.member_id)} --group ${q(r.group_number)} --fname ${q(r.first_name)} --dob ${r.dob} --sex ${r.sex} --street ${q(r.address_street)} --city ${q(r.address_city)} --st ${q(r.address_state)} --zip ${q(r.address_zip)}`,
        verify: `${OE} verify-insurance --lname ${q(L)} --carrier ${q(r.insurance_carrier)} --member-id ${q(r.member_id)} --group ${q(r.group_number)}` },
      { id: 'document', bullet: `Attach ${r.file} to the patient's Documents`, depends_on: ['patient'],
        command: `${OE} upload-doc --lname ${q(L)} --file {{PDF}}`,
        verify: `${OE} verify-doc --lname ${q(L)} --file {{PDF}}` },
      { id: 'appointment', bullet: `Book a New Patient appointment next weekday ${time}`, depends_on: ['patient'],
        command: `${OE} book-appt --lname ${q(L)} --date next-weekday --time ${time} --category 'New Patient'`,
        verify: `${OE} verify-appt --lname ${q(L)} --date next-weekday --time ${time}` },
    ],
  };
});
const out = {
  workflow: 'Referral fax intake: create patient with demographics + insurance, attach the referral PDF, book a new-patient appointment' + (src === keyFile ? ' (values typed from the answer key referrals.json, NOT extracted from the PDFs)' : ` (values extracted from the PDFs: ${path.basename(src)})`),
  target_url: 'https://demo.openemr.io/openemr', manual_seconds: +opt('manual-seconds', '240'), manual_seconds_placeholder: !argv.includes('--manual-seconds'),
  setup: [{ id: 'login', bullet: 'Log in to OpenEMR (admin — receptionist cannot open patient Documents)', command: `${OE} login --user admin --pass pass`, verify: `${OE} verify-login` }],
  items,
};
const f = opt('out', 'commands.referrals.json'); fs.writeFileSync(f, JSON.stringify(out, null, 2)); console.log('wrote', f, 'with', items.length, 'item(s); values from', src, src === keyFile ? '(ANSWER KEY — not extracted)' : '(scored against ' + keyFile + ')');
