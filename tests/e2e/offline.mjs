// End-to-end offline check against the production build, in headless Chromium.
// Phase 4 acceptance: after one online visit, the app loads, generates puzzles and switches
// between all 3 languages with the network disabled.
//
// Run: npm run build && npm run test:offline
import { spawn } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const SW_FILE = 'dist/sw.js';
const originalSw = readFileSync(SW_FILE, 'utf8');
const PORT = 4179;
const BASE = `http://localhost:${PORT}`;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

// Own process group, so npx and the vite process under it both stop at the end.
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
const stopServer = () => {
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {}
};

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview server did not start');
}

const gridCells = (page) => page.locator('[role="gridcell"]');
/** Waits (up to 5 s) for an element instead of checking once. */
const visible = (locator) => locator.waitFor({ timeout: 5000 }).then(() => true, () => false);

try {
  await waitForServer();
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // 1. One online visit: the service worker installs and precaches everything.
  await page.goto(`${BASE}/en`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // let the worker take control of the page
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  check('service worker controls the page after first visit', controlled);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    let n = 0;
    for (const name of names) n += (await (await caches.open(name)).keys()).length;
    return n;
  });
  check('precache populated', cached >= 20, `${cached} entries`);

  // 2. Go offline.
  await context.setOffline(true);
  check('browser reports offline', await page.evaluate(() => navigator.onLine === false));

  // 3. Load a game page cold, while offline.
  await page.goto(`${BASE}/en/play/easy`);
  await gridCells(page).first().waitFor({ timeout: 15000 });
  check('offline: game page loads and generates an Easy puzzle', (await gridCells(page).count()) === 81);
  check(
    'offline: banner is shown',
    await visible(page.getByText("You're offline. Everything still works.")),
  );

  // 4. The game is playable offline.
  const empty = page.locator('[role="gridcell"][aria-label$=": empty"]').first();
  await empty.click();
  await page.keyboard.press('n');
  await page.keyboard.press('5');
  const label = await page.locator('[role="gridcell"][aria-selected="true"]').getAttribute('aria-label');
  check('offline: input works (note placed)', /notes 5$/.test(label ?? ''), label ?? '');

  // 5. Switch languages offline via the header switcher.
  const switcher = page.locator('header select');
  await switcher.selectOption('fr');
  await page.waitForURL(`${BASE}/fr/play/easy`);
  check('offline: switch to French', await visible(page.getByRole('grid', { name: 'Grille de Sudoku' })));

  await switcher.selectOption('ar');
  await page.waitForURL(`${BASE}/ar/play/easy`);
  const dir = await page.evaluate(() => document.documentElement.dir);
  check('offline: switch to Arabic (RTL)', dir === 'rtl' && (await visible(page.getByRole('grid', { name: 'شبكة السودوكو' }))), `dir=${dir}`);

  const arabicFont = await page.evaluate(async () => {
    await document.fonts.load('16px "Noto Sans Arabic"', 'ع');
    return document.fonts.check('16px "Noto Sans Arabic"', 'ع');
  });
  check('offline: Arabic font loads from cache', arabicFont);

  await switcher.selectOption('en');
  await page.waitForURL(`${BASE}/en/play/easy`);
  check('offline: back to English', await visible(page.getByRole('grid', { name: 'Sudoku grid' })));

  // 6. A route never visited before, in another language, loads offline (navigation fallback).
  await page.goto(`${BASE}/fr/daily`);
  check('offline: unvisited route /fr/daily loads', await visible(page.getByRole('heading', { name: 'Défi du jour', level: 1 })));

  // 6b. Prerendered pages and lazily loaded page chunks are served offline too.
  await page.goto(`${BASE}/ar/how-to-play`);
  check('offline: lazy page /ar/how-to-play loads', await visible(page.getByRole('heading', { name: 'طريقة لعب السودوكو', level: 1 })));
  const offlineHtml = await page.evaluate(async () => (await fetch('/fr/play/hard')).text());
  check('offline: prerendered HTML served from cache', offlineHtml.includes('<title>Sudoku difficile') && offlineHtml.includes('hreflang="ar"'));
  await page.goto(`${BASE}/en/stats`);
  check('offline: lazy page /en/stats loads', await visible(page.getByRole('heading', { name: 'Statistics', level: 1 })));

  // 7. Harder puzzles generate offline too (in the worker).
  for (const difficulty of ['expert', 'master']) {
    const started = Date.now();
    await page.goto(`${BASE}/en/play/${difficulty}`);
    await page.waitForFunction(() => document.querySelectorAll('[role="gridcell"]').length === 81 && !document.querySelector('[role="status"] .animate-spin'), null, { timeout: 30000 });
    check(`offline: ${difficulty} puzzle generated`, true, `${Date.now() - started} ms`);
  }

  // 8. Progress survives an offline reload.
  const before = await page.evaluate(() => localStorage.getItem('sudoku:game'));
  await page.reload();
  await gridCells(page).first().waitFor();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('sudoku:game')).data.puzzle.id);
  check('offline: saved game restored after reload', JSON.parse(before).data.puzzle.id === after);

  // 9. A new deploy prompts instead of reloading mid-game.
  await context.setOffline(false);
  await page.goto(`${BASE}/en/play/easy`);
  await gridCells(page).first().waitFor();
  await page.evaluate(() => (window.__notReloaded = true));
  appendFileSync(SW_FILE, `\n// e2e redeploy ${Date.now()}\n`); // a changed sw.js = a new version
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  const prompted = await visible(page.getByText('A new version is available.'));
  check('new version: update prompt shown', prompted);
  check('new version: page was not reloaded automatically', await page.evaluate(() => window.__notReloaded === true));
  await page.getByRole('button', { name: 'Reload' }).click();
  await page.waitForFunction(() => window.__notReloaded === undefined, null, { timeout: 10000 }).then(
    () => check('new version: "Reload" activates it', true),
    () => check('new version: "Reload" activates it', false),
  );

  check('no uncaught page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
} catch (e) {
  check('run completed', false, e.message);
} finally {
  writeFileSync(SW_FILE, originalSw); // undo the simulated redeploy
  stopServer();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
