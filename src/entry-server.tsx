// Server entry used at build time to prerender every page to static HTML (see vite.config.ts).
import { renderToString } from 'react-dom/server';
import { StaticRouterProvider, createStaticHandler, createStaticRouter } from 'react-router-dom/server';
import { routes } from './App';
import { applyLocale, localeDir } from './i18n';
import { DEFAULT_LOCALE, isLocale } from './i18n/locales';
import { headToHtml, serverHead } from './seo/head';
import { dailyRequest } from './logic/daily';
import { generatePuzzle } from './logic/generator';
import { gridToString } from './logic/points';

export { prerenderUrls, robotsTxt, sitemapXml } from './seo/site';

export interface RenderResult {
  html: string;
  head: string;
  lang: string;
  dir: 'ltr' | 'rtl';
}

export async function render(url: string): Promise<RenderResult> {
  const prefix = url.split('/')[1];
  const lang = isLocale(prefix) ? prefix : DEFAULT_LOCALE;
  applyLocale(lang);
  serverHead.current = null;

  const { query, dataRoutes } = createStaticHandler(routes);
  const context = await query(new Request(new URL(url, 'http://localhost')));
  if (context instanceof Response) throw new Error(`Unexpected redirect while prerendering ${url}`);
  const router = createStaticRouter(dataRoutes, context);
  const html = renderToString(<StaticRouterProvider router={router} context={context} hydrate={false} />);

  if (!serverHead.current) throw new Error(`Page ${url} did not call useSeo()`);
  return { html, head: headToHtml(serverHead.current), lang, dir: localeDir(lang) };
}

/** The givens of a day's official daily puzzle, as the API's 81-character string (used to build daily-index.json). */
export function dailyGivens(key: string): string {
  const { difficulty, seed, id } = dailyRequest(key);
  return gridToString(generatePuzzle(difficulty, seed, id).givens);
}
export { addDays, dateKey } from './logic/daily';
