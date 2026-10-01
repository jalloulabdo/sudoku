// Lighthouse audit (mobile, simulated throttling) of the production build, served with
// compression by scripts/serve-dist.mjs. Uses Playwright's Chromium.
// Run: npm run build && npm run lighthouse [-- /en /fr/play/hard ...]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import lighthouse from 'lighthouse';
import { chromium } from 'playwright';

const PORT = 4182;
const DEBUG_PORT = 9333;
const PAGES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['/en', '/en/play/easy', '/ar/play/hard', '/fr/daily', '/fr/how-to-play'];
const TARGETS = { performance: 95, accessibility: 95, 'best-practices': 95, seo: 95 };

const server = spawn('node', ['scripts/serve-dist.mjs', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ args: [`--remote-debugging-port=${DEBUG_PORT}`] });
mkdirSync('lighthouse-reports', { recursive: true });

let failed = false;
try {
  for (const page of PAGES) {
    const result = await lighthouse(`http://localhost:${PORT}${page}`, {
      port: DEBUG_PORT,
      output: ['html', 'json'],
      logLevel: 'error',
      onlyCategories: Object.keys(TARGETS),
    });
    const { categories, audits } = result.lhr;
    const name = page.slice(1).replaceAll('/', '_') || 'root';
    writeFileSync(`lighthouse-reports/${name}.html`, result.report[0]);
    writeFileSync(`lighthouse-reports/${name}.json`, result.report[1]);

    const scores = Object.entries(TARGETS).map(([id, min]) => {
      const score = Math.round(categories[id].score * 100);
      if (score < min) failed = true;
      return `${categories[id].title} ${score}${score < min ? ' ✗' : ''}`;
    });
    console.log(`\n${page}\n  ${scores.join(' | ')}`);
    console.log(
      `  LCP ${audits['largest-contentful-paint'].displayValue} | CLS ${audits['cumulative-layout-shift'].displayValue} | TBT ${audits['total-blocking-time'].displayValue} | FCP ${audits['first-contentful-paint'].displayValue}`,
    );
    for (const [id, a] of Object.entries(audits)) {
      if (a.score !== null && a.score < 0.9 && !['informative', 'notApplicable', 'manual'].includes(a.scoreDisplayMode)) {
        console.log(`  - ${id}${a.displayValue ? `: ${a.displayValue}` : ''}`);
      }
    }
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(`\nReports written to lighthouse-reports/`);
process.exit(failed ? 1 : 0);
