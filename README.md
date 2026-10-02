# Sudoku Master

A fast, mobile-first Sudoku web app that works offline, in English, French and Arabic (RTL).

- 5 difficulty levels, rated by the solving technique each puzzle needs, every puzzle with a unique solution
- Hints that explain the logic (singles, pointing pairs, box/line reduction, pairs, triples, X-Wing, XY-Wing)
- Notes, undo/redo, mistake limit with a second chance, timer, statistics
- Daily challenge with streaks and monthly badges
- Installable PWA: plays fully offline after the first visit
- Prerendered pages with per-language SEO (hreflang, JSON-LD, sitemap)
- Accounts with passwordless sign-in (magic link by email) and a profile

## Stack

React 18 + TypeScript, Vite, Tailwind CSS 4, Zustand, i18next, React Router, Framer Motion, vite-plugin-pwa (Workbox).
Puzzles are generated on the device in a Web Worker, so the game itself needs no server.

Accounts run on **Cloudflare**: the site is hosted on Cloudflare Pages, the API (`/api/*`) is a Pages Function
(`functions/` → `server/`), data lives in Cloudflare D1 (SQLite, schema in `migrations/`), sign-in emails go through
[Resend](https://resend.com), and Cloudflare Turnstile protects the sign-in form.

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

# Full stack locally (site + API + local D1 on Cloudflare's runtime)
cp .dev.vars.example .dev.vars   # once; APP_ENV=development prints sign-in links in the terminal
npm run db:migrate:local         # once, and after adding a migration
npm run build && npm run dev:api # http://localhost:8788
#   or, with hot reload: `npm run dev:api` in one terminal and `npm run dev` in another (Vite proxies /api)
npm run test:accounts            # sign-in end-to-end check on Wrangler (after a build)
```

The offline and Lighthouse checks need Playwright's Chromium: `npx playwright install chromium-headless-shell`.

## Deploying to Cloudflare

One-time setup (needs a Cloudflare account; `npx wrangler login` first):

1. **Database:** `npx wrangler d1 create sudoku-master`, then put the printed `database_id` in `wrangler.toml`, and run `npm run db:migrate:remote`.
2. **Project:** `npx wrangler pages project create sudoku-master --production-branch main`.
3. **Email (Resend):** create an API key and verify your sending domain in Resend (it gives you DNS records to add in Cloudflare DNS).
4. **Turnstile:** in the Cloudflare dashboard → Turnstile, add a widget for your domain to get a site key and a secret.
5. **Secrets** (stored encrypted by Cloudflare, never in the repo):
   ```bash
   npx wrangler pages secret put RESEND_API_KEY
   npx wrangler pages secret put EMAIL_FROM        # e.g. Sudoku Master <login@your-domain.com>
   npx wrangler pages secret put TURNSTILE_SECRET
   ```

Deploy (the `VITE_*` values are public and baked into the build):

```bash
VITE_SITE_URL=https://your-domain.com VITE_TURNSTILE_SITE_KEY=0x... npm run deploy
```

You can instead connect the GitHub repository in Cloudflare Pages (build command `npm run build`, output `dist`,
environment variables `NODE_VERSION=20`, `VITE_SITE_URL`, `VITE_TURNSTILE_SITE_KEY`) to deploy on every push.

**Domain and protection.** In Pages → Custom domains, add your domain. With its DNS on Cloudflare (proxied, orange cloud)
all traffic goes through Cloudflare's network, which provides DDoS protection, the WAF, caching and HTTP/3. Recommended
dashboard settings: SSL/TLS *Full (strict)*, *Always Use HTTPS*, *Bot Fight Mode*, and a rate-limiting rule on
`/api/auth/*`. The app already sends its own security headers (CSP, HSTS, frame and referrer policies) from `dist/_headers`,
and the API rate-limits sign-in requests per email and per IP.

Paths that aren't prerendered (e.g. `/fr/daily/2026-09-30`) are served `index.html` by Pages automatically.

## Project layout

```
src/logic/     solver, technique-based hint engine, generator (pure TypeScript)
src/store/     Zustand stores, persistence, timer, puzzle loading
src/i18n/      i18next setup and the en / fr / ar locale files
src/components, src/pages   UI
src/seo/       head tags, sitemap, prerendered routes
src/sw.ts      service worker
server/        API: magic-link auth, profile (runs as a Cloudflare Pages Function)
functions/     Pages Functions entry point
migrations/    D1 database schema
tests/         unit, UI (jsdom), API (in-memory SQLite) and end-to-end tests
```
