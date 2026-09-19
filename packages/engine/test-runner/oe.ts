#!/usr/bin/env -S npx tsx
// oe.ts — thin client: `npx tsx oe.ts <action> --key value ...` POSTs to the OpenEMR session the runner holds ($OE_PORT).
// Exit 0 = action succeeded (for verify-* actions: state was re-read on a fresh page load). Exit 1 = failed (error on stderr).
import * as http from 'http';
const [action, ...rest] = process.argv.slice(2);
const args: Record<string, string> = {};
for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) { args[rest[i].slice(2)] = rest[i + 1]; i++; }
const port = process.env.OE_PORT;
if (!action || !port) { console.error('usage: OE_PORT=<port> oe.ts <action> [--key value ...]  (OE_PORT is set by run.ts)'); process.exit(2); }
const req = http.request({ host: '127.0.0.1', port: +port, path: '/' + action, method: 'POST', timeout: 180000 }, res => {
  let d = ''; res.on('data', c => d += c); res.on('end', () => {
    const r = JSON.parse(d); for (const l of r.log) console.log(l);
    if (!r.ok) { console.error(`ERROR in ${action}: ${r.error}`); process.exit(1); } process.exit(0);
  });
});
req.on('error', e => { console.error('cannot reach OpenEMR session on port ' + port + ': ' + e.message); process.exit(1); });
req.end(JSON.stringify(args));
