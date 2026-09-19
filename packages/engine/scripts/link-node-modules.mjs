// Each tool folder calls its own ./node_modules/.bin/tsx (and Playwright with PLAYWRIGHT_BROWSERS_PATH=0),
// exactly as it did while it was being built. After a single root `npm install`, point each of those
// folders' node_modules at the root node_modules so every tool shares one install.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tools = ['auth-broker', 'automation-server', 'openemr-cli', 'test-runner', 'triage'];
for (const t of tools) {
  const dir = path.join(root, t);
  if (!fs.existsSync(dir)) continue;
  const link = path.join(dir, 'node_modules');
  try { fs.lstatSync(link); continue; } catch { /* not there yet */ }
  fs.symlinkSync('../node_modules', link, 'dir');
  console.log(`linked ${t}/node_modules -> ../node_modules`);
}
