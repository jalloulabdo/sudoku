import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const SSR_ENTRY = resolve('dist-ssr/entry-server.js');
const DAILY_INDEX = resolve('data/daily-index.json');
const DAILY_WINDOW = { past: 3, future: 120 };

/**
 * Fingerprints (SHA-256 of the givens) of the official daily puzzles, which the API uses to
 * check that a daily score is for the real puzzle. Generation takes ~0.2 s per day, so results
 * are cached in data/daily-index.json (committed) and only new days are computed.
 */
function updateDailyIndex(ssr: { dailyGivens(key: string): string; addDays(key: string, n: number): string; dateKey(d?: Date): string }): string {
  const index: Record<string, string> = existsSync(DAILY_INDEX) ? JSON.parse(readFileSync(DAILY_INDEX, 'utf8')) : {};
  const today = ssr.dateKey(new Date());
  let added = 0;
  for (let i = -DAILY_WINDOW.past; i <= DAILY_WINDOW.future; i++) {
    const key = ssr.addDays(today, i);
    if (index[key]) continue;
    index[key] = createHash('sha256').update(ssr.dailyGivens(key)).digest('hex');
    added++;
  }
  const sorted = Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
  if (added) {
    mkdirSync(dirname(DAILY_INDEX), { recursive: true });
    writeFileSync(DAILY_INDEX, JSON.stringify(sorted, null, 1) + '\n');
  }
  return JSON.stringify(sorted);
}

/**
 * Cloudflare Pages `_headers`: security headers on every response and long caching for
 * hashed assets. The CSP allows the one inline script (the theme loader in index.html) by its
 * hash, and Cloudflare Turnstile for the sign-in form.
 */
function cloudflareHeaders(html: string): string {
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    (m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`,
  );
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${inline.join(' ')} https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'", // inlined stylesheet + animation styles
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    'frame-src https://challenges.cloudflare.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
  return `/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/sw.js
  Cache-Control: no-cache
`;
}

/**
 * Renders every page (from the SSR build in dist-ssr/) into static HTML while the client
 * bundle is generated, so the files exist before the service worker's precache list is built.
 */
function prerender(): Plugin {
  return {
    name: 'sudoku:prerender',
    apply: 'build',
    enforce: 'post',
    async generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') throw new Error('prerender: index.html not found in bundle');
      // Inline the (single, small) stylesheet: one less render-blocking request before first paint.
      const cssAsset = Object.values(bundle).find((f) => f.type === 'asset' && f.fileName.endsWith('.css'));
      if (!cssAsset || cssAsset.type !== 'asset') throw new Error('prerender: stylesheet not found in bundle');
      const cssLink = new RegExp(`<link rel="stylesheet"[^>]*href="/${cssAsset.fileName}"[^>]*>`);
      let template = String(index.source);
      if (!cssLink.test(template)) throw new Error('prerender: stylesheet link not found in index.html');
      template = template.replace(cssLink, () => `<style>${String(cssAsset.source)}</style>`);

      // Arabic pages start fetching their font with the HTML, not after the stylesheet.
      const arabicFont = Object.values(bundle).find((f) => /noto-sans-arabic-arabic-400-normal.*\.woff2$/.test(f.fileName));
      const fontPreload = arabicFont
        ? `<link rel="preload" href="/${arabicFont.fileName}" as="font" type="font/woff2" crossorigin>`
        : '';

      // No cache-busting query: lazy page chunks import this same module, and must share its state.
      const ssr = await import(pathToFileURL(SSR_ENTRY).href);

      for (const url of ssr.prerenderUrls() as string[]) {
        const r = await ssr.render(url);
        const page = template
          .replace('<html lang="en" dir="ltr">', `<html lang="${r.lang}" dir="${r.dir}">`)
          .replace(/<title>.*?<\/title>/, () => r.head + (r.lang === 'ar' ? `\n    ${fontPreload}` : ''))
          .replace('<div id="root"></div>', `<div id="root">${r.html}</div>`);
        if (!page.includes(`lang="${r.lang}"`) || !page.includes('data-seo') || page.includes('<div id="root"></div>')) {
          throw new Error(`prerender: template placeholders missing for ${url}`);
        }
        if (url === '/') index.source = page;
        else this.emitFile({ type: 'asset', fileName: `${url.slice(1)}/index.html`, source: page });
      }
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: ssr.sitemapXml() });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: ssr.robotsTxt() });
      this.emitFile({ type: 'asset', fileName: '_headers', source: cloudflareHeaders(template) });
      this.emitFile({ type: 'asset', fileName: 'daily-index.json', source: updateDailyIndex(ssr) });
    },
  };
}

export default defineConfig(({ isSsrBuild }) => ({
  // `npm run dev` + `npm run dev:api`: the API runs in Wrangler (Pages Functions + local D1).
  server: { proxy: { '/api': 'http://localhost:8788' } },
  plugins: [
    react(),
    tailwindcss(),
    ...(isSsrBuild ? [] : [prerender()]),
    VitePWA({
      // The SSR build only needs the plugin's virtual modules, not a service worker.
      disable: !!isSsrBuild,
      // Never reload on our own: UpdateToast asks the player first.
      registerType: 'prompt',
      injectRegister: false,
      includeManifestIcons: false, // already matched by globPatterns below
      manifest: {
        id: '/',
        name: 'Sudoku Master',
        short_name: 'Sudoku',
        description: 'Play Sudoku anytime, anywhere — even without an internet connection.',
        lang: 'en',
        dir: 'auto',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0b1120',
        background_color: '#0b1120',
        categories: ['games', 'puzzle'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Custom service worker (src/sw.ts): needed to map clean page URLs to prerendered files.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        // Everything the app needs offline: every prerendered page, the bundles (locales are
        // inside them), the generator worker, icons and the self-hosted Arabic font. woff2
        // only: every browser with service workers supports it. The manifest itself is added
        // by the plugin.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
  worker: { format: 'es' },
}));
