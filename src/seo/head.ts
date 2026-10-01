import { LOCALES, type Locale } from '../i18n/locales';
import { SITE_URL, xDefault } from './site';

export interface HeadData {
  title: string;
  description: string;
  locale: Locale;
  /** Path without the language prefix, e.g. '/play/easy' ('' = home). */
  path: string;
  noindex?: boolean;
  /** The language chooser at '/'. */
  isRoot?: boolean;
}

/** Filled during server rendering by useSeo(), read by the prerenderer. */
export const serverHead: { current: HeadData | null } = { current: null };

const OG_LOCALE: Record<Locale, string> = { en: 'en_US', fr: 'fr_FR', ar: 'ar_AR' };

type Tag = { tag: 'meta' | 'link' | 'script'; attrs: Record<string, string>; text?: string };

function tags(h: HeadData): Tag[] {
  const url = h.isRoot ? `${SITE_URL}/` : `${SITE_URL}/${h.locale}${h.path}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Sudoku Master',
    description: h.description,
    url,
    inLanguage: h.locale,
    applicationCategory: 'GameApplication',
    genre: 'Puzzle',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  return [
    { tag: 'meta', attrs: { name: 'description', content: h.description } },
    ...(h.noindex ? [{ tag: 'meta' as const, attrs: { name: 'robots', content: 'noindex' } }] : []),
    { tag: 'link', attrs: { rel: 'canonical', href: url } },
    ...LOCALES.map((l) => ({ tag: 'link' as const, attrs: { rel: 'alternate', hreflang: l.code, href: `${SITE_URL}/${l.code}${h.path}` } })),
    { tag: 'link', attrs: { rel: 'alternate', hreflang: 'x-default', href: xDefault(h.path) } },
    { tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
    { tag: 'meta', attrs: { property: 'og:site_name', content: 'Sudoku Master' } },
    { tag: 'meta', attrs: { property: 'og:title', content: h.title } },
    { tag: 'meta', attrs: { property: 'og:description', content: h.description } },
    { tag: 'meta', attrs: { property: 'og:url', content: url } },
    { tag: 'meta', attrs: { property: 'og:locale', content: OG_LOCALE[h.locale] } },
    { tag: 'meta', attrs: { property: 'og:image', content: `${SITE_URL}/pwa-512x512.png` } },
    { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary' } },
    { tag: 'script', attrs: { type: 'application/ld+json' }, text: JSON.stringify(jsonLd).replace(/</g, '\\u003c') },
  ];
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Head markup for a prerendered page. Every tag but <title> carries data-seo so the client can replace it. */
export function headToHtml(h: HeadData): string {
  const lines = [`<title>${escapeHtml(h.title)}</title>`];
  for (const t of tags(h)) {
    const attrs = Object.entries(t.attrs)
      .map(([k, v]) => `${k}="${escapeHtml(v)}"`)
      .join(' ');
    lines.push(t.tag === 'script' ? `<script data-seo ${attrs}>${t.text}</script>` : `<${t.tag} data-seo ${attrs} />`);
  }
  return lines.join('\n    ');
}

/** Keeps the live document's head in sync after client-side navigation. */
export function applyHead(h: HeadData): void {
  document.title = h.title;
  document.head.querySelectorAll('[data-seo]').forEach((el) => el.remove());
  for (const t of tags(h)) {
    const el = document.createElement(t.tag);
    el.setAttribute('data-seo', '');
    for (const [k, v] of Object.entries(t.attrs)) el.setAttribute(k, v);
    if (t.text) el.textContent = t.text;
    document.head.appendChild(el);
  }
}
