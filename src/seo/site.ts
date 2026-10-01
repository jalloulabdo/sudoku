import { LOCALES } from '../i18n/locales';
import { DIFFICULTIES } from '../logic/types';

/** Absolute origin used in canonical URLs, hreflang links and the sitemap. Set VITE_SITE_URL at build time. */
export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://sudoku-master.example').replace(/\/$/, '');

/** Pages under each language prefix ('' = the language's home page). */
export const PAGE_PATHS = ['', ...DIFFICULTIES.map((d) => `/play/${d}`), '/daily', '/how-to-play', '/stats'];

/** Pages kept out of search results (personal data, nothing to index). */
export const NOINDEX_PATHS = new Set(['/stats']);

/** Every URL rendered to static HTML at build time. */
export function prerenderUrls(): string[] {
  return ['/', ...LOCALES.flatMap((l) => PAGE_PATHS.map((p) => `/${l.code}${p}`))];
}

export function sitemapXml(): string {
  const urls = PAGE_PATHS.filter((p) => !NOINDEX_PATHS.has(p)).flatMap((path) =>
    LOCALES.map((l) => {
      const alternates = [
        ...LOCALES.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.code}" href="${SITE_URL}/${a.code}${path}"/>`),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefault(path)}"/>`,
      ].join('\n');
      return `  <url>\n    <loc>${SITE_URL}/${l.code}${path}</loc>\n${alternates}\n  </url>`;
    }),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

export function robotsTxt(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}

/** The language-neutral version of a page: the language chooser for home, English otherwise. */
export function xDefault(path: string): string {
  return path === '' ? `${SITE_URL}/` : `${SITE_URL}/en${path}`;
}
