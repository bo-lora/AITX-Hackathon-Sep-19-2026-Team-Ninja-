/** Forced logout for test (b): remove all cookies from a storageState file (localStorage kept). */
import * as fs from 'node:fs';
const f = process.argv[2];
const s = JSON.parse(fs.readFileSync(f, 'utf8'));
const before = (s.cookies ?? []).length;
s.cookies = [];
fs.writeFileSync(f, JSON.stringify(s, null, 2));
const after = JSON.parse(fs.readFileSync(f, 'utf8')).cookies.length;
console.log(`strip-cookies: ${f} cookies before=${before} after=${after}`);
