// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { routes } from '../../src/App';
import '../../src/i18n';
import { gridToString } from '../../src/logic/points';
import { accountStore } from '../../src/store/accountStore';
import { gameStore } from '../../src/store/gameStore';
import { initScoreSync } from '../../src/store/scoreSync';
import { uiStore } from '../../src/store/uiStore';
import { EMPTY_CELLS, classicPuzzle, resetStores, solutionAt } from '../store/helpers';
import { CLASSIC, CLASSIC_SOLUTION } from '../logic/fixtures';

type Handler = (body: any, url: string) => { status?: number; body: unknown } | 'offline';
let handlers: Record<string, Handler>;
const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = String(input);
  const h = handlers[`${init.method ?? 'GET'} ${url.split('?')[0]}`];
  if (!h) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  const r = h(init.body ? JSON.parse(String(init.body)) : undefined, url);
  if (r === 'offline') throw new TypeError('Failed to fetch');
  return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } });
});
const callsTo = (key: string) => fetchMock.mock.calls.filter(([u, i]) => `${(i as RequestInit)?.method ?? 'GET'} ${String(u).split('?')[0]}` === key);
const USER = { id: 'u1', email: 'p@example.com', username: 'Alice', locale: 'en', createdAt: 0 };
const RESULT = { points: 125, base: 100, timeBonus: 25, penalty: 0, dailyRank: null };

let stop: (() => void) | null = null;
const solveAll = () =>
  act(() => {
    for (const i of EMPTY_CELLS) {
      gameStore.getState().select(i);
      gameStore.getState().place(solutionAt(i));
    }
  });

beforeEach(() => {
  resetStores();
  localStorage.clear();
  uiStore.setState({ score: null });
  accountStore.setState({ status: 'signedIn', user: USER });
  handlers = {
    'POST /api/games/start': () => ({ body: { ticketId: 'ticket-1' } }),
    'POST /api/games/finish': () => ({ body: RESULT }),
  };
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  stop = initScoreSync();
});
afterEach(() => {
  stop?.();
  cleanup();
  vi.unstubAllGlobals();
});

describe('ranked games', () => {
  it('gets a ticket when a signed-in player starts a game', async () => {
    gameStore.getState().newGame(classicPuzzle());
    await waitFor(() => expect(gameStore.getState().game?.ticketId).toBe('ticket-1'));
    expect(JSON.parse(String((callsTo('POST /api/games/start')[0][1] as RequestInit).body))).toEqual({
      puzzleId: 'easy-1',
      difficulty: 'easy',
      givens: gridToString(CLASSIC.map((v) => v || null)),
    });
  });

  it('restarting keeps the ticket', async () => {
    gameStore.getState().newGame(classicPuzzle());
    await waitFor(() => expect(gameStore.getState().game?.ticketId).toBe('ticket-1'));
    gameStore.getState().restart();
    expect(gameStore.getState().game?.ticketId).toBe('ticket-1');
    expect(callsTo('POST /api/games/start')).toHaveLength(1);
  });

  it('signed-out games are not ranked', () => {
    accountStore.setState({ status: 'signedOut', user: null });
    gameStore.getState().newGame(classicPuzzle());
    expect(callsTo('POST /api/games/start')).toHaveLength(0);
    expect(uiStore.getState().score).toEqual({ puzzleId: 'easy-1', state: 'unranked', reason: 'signedOut' });
  });

  it('submits the result on a win and shows the points', async () => {
    gameStore.getState().newGame(classicPuzzle());
    await waitFor(() => expect(gameStore.getState().game?.ticketId).toBe('ticket-1'));
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/en/play/easy'] })} />);
    act(() => gameStore.getState().tick(90_000));
    solveAll();

    const dialog = await screen.findByRole('dialog', { name: 'Puzzle solved!' });
    expect(await within(dialog).findByText('+125 points')).toBeTruthy();
    expect(within(dialog).getByText('Time bonus')).toBeTruthy();
    const body = JSON.parse(String((callsTo('POST /api/games/finish')[0][1] as RequestInit).body));
    expect(body).toEqual({ ticketId: 'ticket-1', solution: CLASSIC_SOLUTION.join(''), elapsedMs: 90_000, mistakes: 0, hints: 0 });
  });

  it('a result finished offline is queued and sent when back online', async () => {
    gameStore.getState().newGame(classicPuzzle());
    await waitFor(() => expect(gameStore.getState().game?.ticketId).toBe('ticket-1'));
    handlers['POST /api/games/finish'] = () => 'offline';
    solveAll();
    await waitFor(() => expect(uiStore.getState().score).toMatchObject({ state: 'queued' }));
    expect(JSON.parse(localStorage.getItem('sudoku:pendingScores')!).data).toHaveLength(1);

    handlers['POST /api/games/finish'] = () => ({ body: RESULT });
    act(() => void window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(uiStore.getState().score).toMatchObject({ state: 'scored', points: 125 }));
    expect(JSON.parse(localStorage.getItem('sudoku:pendingScores')!).data).toHaveLength(0);
  });

  it('a rejected result is dropped, not retried', async () => {
    gameStore.getState().newGame(classicPuzzle());
    await waitFor(() => expect(gameStore.getState().game?.ticketId).toBe('ticket-1'));
    handlers['POST /api/games/finish'] = () => ({ status: 400, body: { error: 'implausible_time' } });
    solveAll();
    await waitFor(() => expect(uiStore.getState().score).toEqual({ puzzleId: 'easy-1', state: 'rejected', code: 'implausible_time' }));
    expect(JSON.parse(localStorage.getItem('sudoku:pendingScores')!).data).toHaveLength(0);
  });

  it('a puzzle already scored plays unranked', async () => {
    handlers['POST /api/games/start'] = () => ({ status: 409, body: { error: 'already_scored' } });
    gameStore.getState().newGame(classicPuzzle());
    await waitFor(() => expect(uiStore.getState().score).toMatchObject({ state: 'unranked', reason: 'alreadyScored' }));
    expect(gameStore.getState().game?.ticketId).toBeNull();
  });
});

describe('leaderboard page', () => {
  const board = (period: string) => ({
    period,
    entries: [
      { rank: 1, username: 'Bob', points: 900, games: 4, elapsedMs: 240_000 },
      { rank: 2, username: 'Carol', points: 500, games: 2, elapsedMs: 300_000 },
    ],
    me: { rank: 7, username: 'Alice', points: 100, games: 1, elapsedMs: 600_000 },
  });

  it('shows the ranking with your own row, and switches periods', async () => {
    handlers['GET /api/leaderboard'] = (_b, url) => ({ body: board(new URL(url, 'http://x').searchParams.get('period')!) });
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/en/leaderboard'] })} />);
    const table = (await screen.findByText('Bob')).closest('table')!;
    const mine = within(table).getByText('Alice').closest('tr')!;
    expect(within(mine).getByText('You')).toBeTruthy();
    expect(within(mine).getByText('7')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: "Today's daily" }));
    await waitFor(() => expect(callsTo('GET /api/leaderboard').some(([u]) => String(u).includes('period=daily&date='))).toBe(true));
    expect(await screen.findByRole('columnheader', { name: 'Time' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: "Today's daily" }).getAttribute('aria-selected')).toBe('true');
  });

  it('explains how points work', async () => {
    handlers['GET /api/leaderboard'] = () => ({ body: { period: 'all', entries: [], me: null } });
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/fr/leaderboard'] })} />);
    expect(await screen.findByText('Aucun score pour le moment. Soyez le premier !')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Comment sont calculés les points' })).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'Maître' })).toBeTruthy();
  });
});
