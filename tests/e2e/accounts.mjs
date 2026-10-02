// End-to-end sign-in on the real Cloudflare stack, run locally: `wrangler pages dev` serves the
// built site and the Pages Functions API on workerd with a local D1 database. In development
// the magic link is printed to Wrangler's log instead of being emailed; this test reads it there.
//
// Run: npm run build && npm run db:migrate:local && npm run test:accounts
// (.dev.vars must contain APP_ENV=development; see .dev.vars.example)
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 8789;
const BASE = `http://localhost:${PORT}`;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

let log = '';
const wrangler = spawn('npx', ['wrangler', 'pages', 'dev', '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
wrangler.stdout.on('data', (d) => (log += d));
wrangler.stderr.on('data', (d) => (log += d));

async function waitFor(fn, timeoutMs, what) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = await fn().catch(() => null);
    if (v) return v;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timed out waiting for ${what}`);
}

const visible = (locator) => locator.waitFor({ timeout: 8000 }).then(() => true, () => false);
const email = `e2e-${Date.now()}@example.com`;

try {
  await waitFor(async () => (await fetch(`${BASE}/api/health`)).ok, 60000, 'wrangler');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const cspViolations = [];
  page.on('console', (m) => /Content Security Policy/i.test(m.text()) && cspViolations.push(m.text()));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // 1. Request a link (French).
  await page.goto(`${BASE}/fr/login`);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByRole('button', { name: 'Envoyer le lien de connexion' }).click();
  check('confirmation shown', await visible(page.getByRole('heading', { name: 'Consultez votre boîte de réception' })));

  // 2. The "email" (printed by the dev mailer).
  const link = await waitFor(async () => {
    const i = log.lastIndexOf(`[dev mail] to ${email}`);
    return i >= 0 ? /(http\S+#token=[\w-]+)/.exec(log.slice(i))?.[1] : null;
  }, 10000, 'magic link in the log');
  check('magic link sent, in French, token in the fragment', /\/fr\/auth\/verify#token=[\w-]{40,}$/.test(link), link.replace(/#token=.*/, '#token=…'));

  // 3. Follow it: signed in, new account → asked for a username.
  await page.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
  await page.waitForURL(`${BASE}/fr/profile`, { timeout: 10000 });
  check('link signs in and opens the profile', true);
  check('token removed from the address bar', !page.url().includes('token'));
  const cookies = await page.context().cookies();
  const sid = cookies.find((c) => c.name === 'sid');
  check('session cookie is HttpOnly, Secure, SameSite=Lax', !!sid && sid.httpOnly && sid.secure && sid.sameSite === 'Lax');
  check('new account is asked for a username', await visible(page.getByText("Choisissez un nom d'utilisateur", { exact: false })));

  // 4. Choose a username.
  const username = `Joueur${Date.now() % 100000}`;
  await page.getByLabel("Nom d'utilisateur").fill(username);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  check('username saved', await visible(page.getByRole('heading', { level: 1, name: username })));

  // 5. Still signed in after a reload; header shows the username.
  await page.reload();
  check('session survives a reload', await visible(page.getByRole('heading', { level: 1, name: username })));
  check('header shows the username', await visible(page.locator('header').getByRole('link', { name: username })));

  // 6. The link can't be reused.
  const reuse = await page.evaluate(async (token) => {
    const r = await fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    return r.status;
  }, link.split('#token=')[1]);
  check('used link is rejected', reuse === 400);

  // 7. Cross-site requests are refused even with the cookie.
  const csrf = await fetch(`${BASE}/api/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example', Cookie: `sid=${sid?.value}` },
    body: JSON.stringify({ username: 'hacked' }),
  });
  check('cross-origin write refused', csrf.status === 403);

  // 8. Sign out.
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await page.waitForURL(`${BASE}/fr`);
  const me = await page.evaluate(async () => (await fetch('/api/me')).status);
  check('signed out', me === 401);

  // 9. Security headers from _headers.
  const res = await fetch(`${BASE}/en`);
  check(
    'security headers served',
    ['content-security-policy', 'strict-transport-security', 'x-content-type-options', 'x-frame-options', 'referrer-policy'].every((h) => res.headers.has(h)),
  );
  check('no CSP violations', cspViolations.length === 0, cspViolations.join(' | '));
  check('no uncaught page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
} catch (e) {
  check('run completed', false, e.message);
  console.log(log.slice(-2000));
} finally {
  wrangler.kill('SIGTERM');
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
