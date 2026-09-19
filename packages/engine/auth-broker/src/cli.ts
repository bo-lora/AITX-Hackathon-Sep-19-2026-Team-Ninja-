#!/usr/bin/env node
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { login, check, runWithAuth, LoginTimeoutError, type AuthOpts } from './broker.js';

function usage(): never {
  process.stderr.write(`usage:
  auth login <url> [--session <file>]
  auth check <url> [--session <file>]
  auth run --url <url> [--login-url <url>] [--session <file>] -- <cmd ...>
`);
  return process.exit(64);
}

async function loadHook(): Promise<AuthOpts['onLoginPage']> {
  // TEST-ONLY: AUTH_LOGIN_HOOK=<module path> exporting default async (page) => void.
  const p = process.env.AUTH_LOGIN_HOOK;
  if (!p) return undefined;
  const mod = await import(pathToFileURL(path.resolve(p)).href);
  return mod.default;
}

async function main() {
  const argv = process.argv.slice(2);
  const dd = argv.indexOf('--');
  const head = dd >= 0 ? argv.slice(0, dd) : argv;
  const tail = dd >= 0 ? argv.slice(dd + 1) : [];
  const [sub, ...rest] = head;
  let url: string | undefined; let sessionFile: string | undefined; let loginUrl: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--session') sessionFile = rest[++i];
    else if (rest[i] === '--url') url = rest[++i];
    else if (rest[i] === '--login-url') loginUrl = rest[++i];
    else if (!url) url = rest[i];
  }
  if (!sub || !url) usage();
  const opts: AuthOpts = { sessionFile, loginUrl, onLoginPage: await loadHook() };

  if (sub === 'login') {
    try { const f = await login(url, opts); process.stdout.write(`LOGGED_IN\n`); process.stderr.write(`session file: ${f}\n`); process.exit(0); }
    catch (e) { if (e instanceof LoginTimeoutError) { process.stdout.write('LOGIN_TIMEOUT\n'); process.exit(2); } throw e; }
  }
  if (sub === 'check') {
    const ok = await check(url, opts);
    process.stdout.write(ok ? 'LOGGED_IN\n' : 'LOGGED_OUT\n');
    process.exit(ok ? 0 : 1);
  }
  if (sub === 'run') {
    if (tail.length === 0) usage();
    try { process.exit(await runWithAuth(url, tail, opts)); }
    catch (e) { if (e instanceof LoginTimeoutError) { process.stdout.write('LOGIN_TIMEOUT\n'); process.exit(2); } throw e; }
  }
  usage();
}
main().catch((e) => { process.stderr.write(`auth-broker error: ${e?.message ?? e}\n`); process.exit(3); });
