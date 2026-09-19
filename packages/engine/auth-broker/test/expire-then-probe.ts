/** Test (c2) wrapped command: 1st invocation simulates a mid-run session expiry (strips cookies from
 * AUTH_SESSION_FILE, exits 1); later invocations run the probe. Marker file tracks invocation count. */
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const sf = process.env.AUTH_SESSION_FILE!;
const marker = process.env.C2_MARKER!;
const n = fs.existsSync(marker) ? Number(fs.readFileSync(marker, 'utf8')) + 1 : 1;
fs.writeFileSync(marker, String(n));
console.log(`C2 wrapped command invocation #${n}`);
if (n === 1) {
  const s = JSON.parse(fs.readFileSync(sf, 'utf8')); s.cookies = []; fs.writeFileSync(sf, JSON.stringify(s));
  console.log('C2: simulated session expiry mid-run (cookies removed), exiting 1'); process.exit(1);
}
try { execFileSync('node_modules/.bin/tsx', ['test/probe-main.ts'], { stdio: 'inherit' }); } catch { process.exit(1); }
