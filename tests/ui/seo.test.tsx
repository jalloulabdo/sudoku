// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { routes } from '../../src/App';
import '../../src/i18n';
import { gameStore } from '../../src/store/gameStore';
import { prerenderUrls, sitemapXml } from '../../src/seo/site';
import { classicPuzzle, resetStores } from '../store/helpers';

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
};
const meta = (sel: string) => document.head.querySelector(sel)?.getAttribute('content') ?? document.head.querySelector(sel)?.getAttribute('href');

beforeEach(() => resetStores());
afterEach(cleanup);

describe('page head', () => {
  it('difficulty landing pages get a translated title, description, canonical and hreflang', async () => {
    renderAt('/fr/play/hard');
    await waitFor(() => expect(document.title).toBe('Sudoku difficile : jouer gratuitement en ligne | Sudoku Master'));
    expect(meta('meta[name="description"]')).toMatch(/^Grilles de Sudoku difficiles/);
    expect(meta('link[rel="canonical"]')).toBe('https://sudoku-master.example/fr/play/hard');
    const alternates = [...document.head.querySelectorAll('link[rel="alternate"]')].map((l) => `${l.getAttribute('hreflang')}=${l.getAttribute('href')}`);
    expect(alternates).toEqual([
      'en=https://sudoku-master.example/en/play/hard',
      'fr=https://sudoku-master.example/fr/play/hard',
      'ar=https://sudoku-master.example/ar/play/hard',
      'x-default=https://sudoku-master.example/en/play/hard',
    ]);
    const ld = JSON.parse(document.head.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(ld).toMatchObject({ '@type': 'WebApplication', applicationCategory: 'GameApplication', inLanguage: 'fr' });
    expect(screen.getByRole('heading', { level: 1, name: 'Sudoku difficile' })).toBeTruthy();
  });

  it('client navigation replaces the tags instead of piling them up', async () => {
    const router = renderAt('/en/play/easy');
    await waitFor(() => expect(document.title).toMatch(/^Easy Sudoku/));
    await act(() => router.navigate('/en/how-to-play'));
    await waitFor(() => expect(document.title).toMatch(/^How to Play Sudoku/));
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
  });

  it('stats are kept out of search results', async () => {
    renderAt('/en/stats');
    await waitFor(() => expect(meta('meta[name="robots"]')).toBe('noindex'));
  });
});

describe('how to play', () => {
  it('lists the rules and every technique, translated', async () => {
    renderAt('/ar/how-to-play');
    expect(await screen.findByRole('heading', { level: 1, name: 'طريقة لعب السودوكو' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(10);
    expect(screen.getByRole('heading', { level: 3, name: 'إكس-وينغ' })).toBeTruthy();
  });
});

describe('accessibility', () => {
  it('has a skip link to the main content', async () => {
    renderAt('/en');
    const skip = await screen.findByRole('link', { name: 'Skip to content' });
    expect(skip.getAttribute('href')).toBe('#main');
    expect(document.getElementById('main')?.tagName).toBe('MAIN');
  });

  it('announces placed digits', async () => {
    gameStore.getState().newGame(classicPuzzle());
    renderAt('/en/play/easy');
    act(() => {
      gameStore.getState().select(2);
      gameStore.getState().place(4);
    });
    await waitFor(() => expect(screen.getByText('4 placed in R1C3')).toBeTruthy());
  });
});

describe('sitemap', () => {
  it('lists every indexable page in every language with alternates', () => {
    const xml = sitemapXml();
    expect(xml.match(/<loc>/g)).toHaveLength(3 * 9); // 10 pages per language minus stats
    expect(xml).toContain('<loc>https://sudoku-master.example/ar/how-to-play</loc>');
    expect(xml).not.toContain('/stats</loc>');
    expect(prerenderUrls()).toHaveLength(1 + 3 * 10);
    expect(xml).toContain('<loc>https://sudoku-master.example/fr/leaderboard</loc>');
  });
});
