/**
 * auth-broker: headed human login + headless session check + auto-recovering wrapper.
 * Never reads, logs, prints or stores form field values. Only Playwright storageState is saved.
 */
import { chromium, type Page, type Browser } from 'playwright';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
export const POLL_MS = 500;

export interface AuthOpts {
  /** Path to the storageState JSON. Default ./sessions/<hostname>.json */
  sessionFile?: string;
  /** URL to open for the headed login. Default: the url passed in. Set this when the checked
   *  URL does not itself show a login form when logged out (OpenEMR: pass .../interface/login/login.php). */
  loginUrl?: string;
  /** Login timeout in ms. Default 5 minutes. */
  timeoutMs?: number;
  /**
   * TEST-ONLY hook, called with the headed login page right after it opens.
   * The real product leaves this unset: Mary types her own credentials.
   */
  onLoginPage?: (page: Page) => Promise<void>;
  /** Log sink for status lines (never receives field values). Default: stderr. */
  log?: (msg: string) => void;
}

export class LoginTimeoutError extends Error {
  code = 'LOGIN_TIMEOUT';
  constructor() { super('LOGIN_TIMEOUT'); }
}

export function defaultSessionFile(url: string): string {
  return path.resolve('sessions', `${new URL(url).hostname}.json`);
}

const LOGIN_PATH_RE = /(^|[\/_\-.])(log-?in|sign-?in|signin|auth\/login)([\/_\-.]|$)/i;

export function looksLikeLoginUrl(u: string): boolean {
  try { return LOGIN_PATH_RE.test(new URL(u).pathname); } catch { return false; }
}

/** True if a password input is visible anywhere on the page (main frame + child frames). */
async function passwordFieldVisible(page: Page): Promise<boolean> {
  for (const frame of page.frames()) {
    try {
      const loc = frame.locator('input[type="password"]');
      const n = await loc.count();
      for (let i = 0; i < n; i++) if (await loc.nth(i).isVisible()) return true;
    } catch { /* frame detached mid-navigation: ignore */ }
  }
  return false;
}

function stderrLog(msg: string) { process.stderr.write(`[auth-broker ${new Date().toISOString()}] ${msg}\n`); }

/**
 * Headed login. Resolves once login is detected and storageState is saved.
 * Detection (polled every 500 ms): URL leaves the login page OR no password field is visible.
 */
export async function login(url: string, opts: AuthOpts = {}): Promise<string> {
  const log = opts.log ?? stderrLog;
  const sessionFile = path.resolve(opts.sessionFile ?? defaultSessionFile(url));
  const timeoutMs = opts.timeoutMs ?? LOGIN_TIMEOUT_MS;
  const browser: Browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(opts.loginUrl ?? url, { waitUntil: 'domcontentloaded' });
    const loginPageUrl = page.url();
    const loginPath = new URL(loginPageUrl).pathname;
    log(`login window open at ${new URL(loginPageUrl).origin}${loginPath} — waiting for the user to log in`);
    if (opts.onLoginPage) await opts.onLoginPage(page);

    const deadline = Date.now() + timeoutMs;
    let done = false;
    while (Date.now() < deadline) {
      await page.waitForTimeout(POLL_MS);
      if (page.isClosed()) throw new Error('LOGIN_WINDOW_CLOSED');
      const cur = page.url();
      if (cur === 'about:blank') continue;
      let leftLoginPage = false;
      try { leftLoginPage = new URL(cur).pathname !== loginPath && !looksLikeLoginUrl(cur); } catch {}
      if (leftLoginPage) { done = true; log('login detected (URL left the login page)'); break; }
      // Only trust "no password field" once the document has at least parsed.
      const ready = await page.evaluate(() => document.readyState).catch(() => 'loading');
      if (ready !== 'loading' && !(await passwordFieldVisible(page))) {
        done = true; log('login detected (password field no longer on the page)'); break;
      }
    }
    if (!done) throw new LoginTimeoutError();
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
    await context.storageState({ path: sessionFile });
    fs.chmodSync(sessionFile, 0o600);
    log(`session saved: ${sessionFile}`);
    return sessionFile;
  } finally {
    await browser.close().catch(() => {});
  }
}

/** Headless check. Returns true = LOGGED_IN, false = LOGGED_OUT. Missing session file = LOGGED_OUT. */
export async function check(url: string, opts: AuthOpts = {}): Promise<boolean> {
  const sessionFile = path.resolve(opts.sessionFile ?? defaultSessionFile(url));
  if (!fs.existsSync(sessionFile)) return false;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ storageState: sessionFile });
    const page = await context.newPage();
    let resp;
    try {
      resp = await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    } catch (e: any) {
      // Headed Chrome surfaces an empty-bodied HTTP error page as a navigation failure.
      if (String(e?.message ?? e).includes('ERR_HTTP_RESPONSE_CODE_FAILURE')) return false;
      throw e;
    }
    await page.waitForTimeout(1000); // allow JS/meta redirects to the login page to fire
    if (looksLikeLoginUrl(page.url())) return false;
    // Extension to the spec rule, driven by observed OpenEMR 8.4 behaviour: a protected page requested
    // without a valid session returns HTTP 400 with an EMPTY body (no redirect, no password field).
    // So: 401/403 = logged out; 400 with an empty body = logged out. Any other status falls through.
    const status = resp?.status() ?? 0;
    if (status === 401 || status === 403) return false;
    if (status === 400) {
      const text = (await page.evaluate(() => document.body?.innerText ?? '').catch(() => '')).trim();
      if (text === '') return false;
    }
    if (await passwordFieldVisible(page)) return false;
    return true;
  } finally {
    await browser.close().catch(() => {});
  }
}

async function ensureLoggedIn(url: string, opts: AuthOpts): Promise<string> {
  const log = opts.log ?? stderrLog;
  const sessionFile = path.resolve(opts.sessionFile ?? defaultSessionFile(url));
  if (await check(url, { ...opts, sessionFile })) { log('check: LOGGED_IN'); return sessionFile; }
  log('check: LOGGED_OUT — opening login window');
  return login(url, { ...opts, sessionFile });
}

/**
 * Run fn with a valid session. If fn throws and the session turns out to be LOGGED_OUT,
 * re-login (headed) and retry fn ONCE. If fn throws while still LOGGED_IN, rethrow unchanged.
 */
export async function withAuth<T>(url: string, fn: (sessionFile: string) => Promise<T>, opts: AuthOpts = {}): Promise<T> {
  const log = opts.log ?? stderrLog;
  const sessionFile = await ensureLoggedIn(url, opts);
  try {
    return await fn(sessionFile);
  } catch (err) {
    if (await check(url, { ...opts, sessionFile })) { log('run failed but check says LOGGED_IN — not retrying'); throw err; }
    log('run failed and check says LOGGED_OUT — re-login then retry once');
    await login(url, { ...opts, sessionFile });
    return await fn(sessionFile); // second failure propagates as-is
  }
}

/** Spawn a command with AUTH_SESSION_FILE set; resolves with its exit code (stdio inherited). */
export function runCommand(cmd: string[], sessionFile: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd[0], cmd.slice(1), { stdio: 'inherit', env: { ...process.env, AUTH_SESSION_FILE: sessionFile } });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve(code ?? (signal ? 128 : 1)));
  });
}

export class CommandFailed extends Error {
  constructor(public exitCode: number) { super(`command exited ${exitCode}`); }
}

/** CLI `auth run`: returns the exit code to use. */
export async function runWithAuth(url: string, cmd: string[], opts: AuthOpts = {}): Promise<number> {
  try {
    await withAuth(url, async (sf) => {
      const code = await runCommand(cmd, sf);
      if (code !== 0) throw new CommandFailed(code);
    }, opts);
    return 0;
  } catch (err) {
    if (err instanceof CommandFailed) return err.exitCode; // original failure passed through
    throw err;
  }
}
