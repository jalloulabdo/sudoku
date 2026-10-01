# Sudoku Master

A fast, mobile-first Sudoku web app that works offline, in English, French and Arabic (RTL).

- 5 difficulty levels, rated by the solving technique each puzzle needs, every puzzle with a unique solution
- Hints that explain the logic (singles, pointing pairs, box/line reduction, pairs, triples, X-Wing, XY-Wing)
- Notes, undo/redo, mistake limit with a second chance, timer, statistics
- Daily challenge with streaks and monthly badges
- Installable PWA: plays fully offline after the first visit
- Prerendered pages with per-language SEO (hreflang, JSON-LD, sitemap)

## Stack

React 18 + TypeScript, Vite, Tailwind CSS 4, Zustand, i18next, React Router, Framer Motion, vite-plugin-pwa (Workbox).
Puzzles are generated on the device in a Web Worker; there is no backend.

## Scripts

```bash
npm install
npm run dev            # dev server on http://localhost:5173
npm run build          # typecheck, build and prerender every page into dist/
npm run preview        # serve the production build
npm test               # unit tests (Vitest)
npm run test:offline   # offline end-to-end check in headless Chromium (after a build)
npm run lighthouse     # Lighthouse audits of the build (after a build)
npm run icons          # regenerate the PWA icons in public/
```

The offline and Lighthouse checks need Playwright's Chromium: `npx playwright install chromium-headless-shell`.

## Deploying

`dist/` is a static site. Before building for production, set the public URL used for canonical links, hreflang and the sitemap:

```bash
VITE_SITE_URL=https://your-domain.com npm run build
```

Paths that aren't prerendered (e.g. `/fr/daily/2026-09-30`) need the host's SPA fallback to `/index.html`.

## Project layout

```
src/logic/     solver, technique-based hint engine, generator (pure TypeScript)
src/store/     Zustand stores, persistence, timer, puzzle loading
src/i18n/      i18next setup and the en / fr / ar locale files
src/components, src/pages   UI
src/seo/       head tags, sitemap, prerendered routes
src/sw.ts      service worker
tests/         unit tests, UI tests (jsdom), offline e2e
```
