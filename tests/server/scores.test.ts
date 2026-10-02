import { createHash } from 'node:crypto';
import { dailyRequest } from '../../src/logic/daily';
import { generatePuzzle, matchesDifficulty } from '../../src/logic/generator';
import { MIN_MS_PER_EMPTY_CELL, computePoints, gridToString } from '../../src/logic/points';
import type { Difficulty, Puzzle } from '../../src/logic/types';
import { weekStart } from '../../server/scores';
import { createApi } from './api';

const MIN = 60_000;
// 2027-01-15 12:00 UTC; the clock used by createApi()'s handlers is set per test.
const NOW = Date.UTC(2027, 0, 15, 12);

const puzzles = new Map<string, Puzzle>();
function puzzle(difficulty: Difficulty, seed: number): Puzzle {
  const key = `${difficulty}-${seed}`;
  if (!puzzles.has(key)) puzzles.set(key, generatePuzzle(difficulty, seed));
  return puzzles.get(key)!;
}
const dailyPuzzle = (key: string) => {
  const r = dailyRequest(key);
  return generatePuzzle(r.difficulty, r.seed, r.id);
};
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const solutionOf = (p: Puzzle) => p.solution.join('');
const emptyCells = (p: Puzzle) => p.givens.filter((v) => v === null).length;

async function setup() {
  const daily = dailyPuzzle('2027-01-15');
  const index = { '2027-01-15': sha(gridToString(daily.givens)) };
  const api = await createApi({ ASSETS: { fetch: async () => new Response(JSON.stringify(index)) } });
  api.clock.now = NOW;
  const player = async (email: string, username?: string) => {
    const { cookie } = await api.signIn(email);
    if (username) await api.call('PATCH', '/api/me', { cookie, body: { username } });
    return cookie;
  };
  const start = (cookie: string, p: Puzzle, overrides: Record<string, unknown> = {}) =>
    api.call('POST', '/api/games/start', {
      cookie,
      body: { puzzleId: p.id, difficulty: p.difficulty, givens: gridToString(p.givens), ...overrides },
    });
  const finish = (cookie: string, ticketId: string, p: Puzzle, overrides: Record<string, unknown> = {}) =>
    api.call('POST', '/api/games/finish', {
      cookie,
      body: { ticketId, solution: solutionOf(p), elapsedMs: 4 * MIN, mistakes: 0, hints: 0, ...overrides },
    });
  /** Starts, waits `elapsed` of server time, and finishes. */
  const play = async (cookie: string, p: Puzzle, result: { elapsedMs?: number; mistakes?: number; hints?: number } = {}) => {
    const { data } = await start(cookie, p);
    api.clock.now += result.elapsedMs ?? 4 * MIN;
    return finish(cookie, data.ticketId, p, result);
  };
  return { api, daily, player, start, finish, play };
}

describe('points', () => {
  it('rewards difficulty and speed, and penalises mistakes and hints', () => {
    expect(computePoints('easy', 6 * MIN, 0, 0)).toEqual({ base: 100, timeBonus: 0, penalty: 0, points: 100 });
    expect(computePoints('easy', 3 * MIN, 0, 0).points).toBe(125); // half of par → +25%
    expect(computePoints('master', 0, 0, 0).points).toBe(1500); // maximum bonus +50%
    expect(computePoints('hard', 15 * MIN, 2, 1).points).toBe(400 - 80 - 60);
    expect(computePoints('medium', 60 * MIN, 30, 30).points).toBe(20); // never below 10% of base
  });

  it('every generated puzzle matches its claimed difficulty', () => {
    for (const d of ['easy', 'medium', 'hard', 'expert'] as Difficulty[]) {
      for (let seed = 1; seed <= 3; seed++) expect(matchesDifficulty(puzzle(d, seed).givens, d)).toBe(true);
    }
    expect(matchesDifficulty(puzzle('easy', 1).givens, 'expert')).toBe(false);
  });
});

describe('starting a game', () => {
  it('needs a session', async () => {
    const { api } = await setup();
    const p = puzzle('easy', 1);
    const res = await api.call('POST', '/api/games/start', { body: { puzzleId: p.id, difficulty: 'easy', givens: gridToString(p.givens) } });
    expect(res.status).toBe(401);
  });

  it('issues a ticket for a valid puzzle, and the same one again after a reload', async () => {
    const { player, start } = await setup();
    const cookie = await player('a@example.com');
    const first = await start(cookie, puzzle('medium', 1));
    expect(first.status).toBe(200);
    expect(first.data.ticketId).toMatch(/^[\w-]{20,}$/);
    expect((await start(cookie, puzzle('medium', 1))).data.ticketId).toBe(first.data.ticketId);
  });

  it('rejects malformed, ambiguous or mislabelled puzzles', async () => {
    const { player, start } = await setup();
    const cookie = await player('a@example.com');
    const easy = puzzle('easy', 1);
    const bad = async (overrides: Record<string, unknown>) => (await start(cookie, easy, overrides)).data.error;
    expect(await bad({ givens: '123' })).toBe('invalid_puzzle');
    expect(await bad({ difficulty: 'legendary' })).toBe('invalid_puzzle');
    expect(await bad({ difficulty: 'expert' })).toBe('invalid_puzzle'); // an easy puzzle sold as expert
    expect(await bad({ givens: '0'.repeat(81) })).toBe('invalid_puzzle'); // many solutions
    const broken = gridToString(easy.givens).replace(/^(\d)/, (d) => (d === '0' ? '0' : String((Number(d) % 9) + 1)));
    expect(await bad({ givens: broken })).toBe('invalid_puzzle');
  });

  it('accepts only the official puzzle as a daily', async () => {
    const { player, start, daily } = await setup();
    const cookie = await player('a@example.com');
    const real = await start(cookie, daily);
    expect(real.data).toMatchObject({ daily: true });
    const fake = { ...puzzle(daily.difficulty, 99), id: 'daily-2027-01-15' };
    expect((await start(cookie, fake)).data.error).toBe('invalid_puzzle');
  });
});

describe('finishing a game', () => {
  it('awards the computed points', async () => {
    const { player, play } = await setup();
    const cookie = await player('a@example.com', 'Alice');
    const res = await play(cookie, puzzle('hard', 1), { elapsedMs: 7.5 * MIN, mistakes: 1, hints: 1 });
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ...computePoints('hard', 7.5 * MIN, 1, 1), dailyRank: null });
  });

  it('rejects wrong solutions', async () => {
    const { api, player, start, finish } = await setup();
    const cookie = await player('a@example.com');
    const p = puzzle('easy', 2);
    const { data } = await start(cookie, p);
    api.clock.now += 5 * MIN;
    const sol = solutionOf(p);
    const firstEmpty = p.givens.indexOf(null);
    const swapped = sol.slice(0, firstEmpty) + ((Number(sol[firstEmpty]) % 9) + 1) + sol.slice(firstEmpty + 1);
    expect((await finish(cookie, data.ticketId, p, { solution: swapped })).data.error).toBe('wrong_solution');
    expect((await finish(cookie, data.ticketId, p, { solution: '1'.repeat(81) })).data.error).toBe('wrong_solution');
  });

  it('rejects times longer than the real time since the start, or inhumanly fast', async () => {
    const { api, player, start, finish } = await setup();
    const cookie = await player('a@example.com');
    const p = puzzle('easy', 3);
    const { data } = await start(cookie, p);
    api.clock.now += 2 * MIN;
    expect((await finish(cookie, data.ticketId, p, { elapsedMs: 10 * MIN })).data.error).toBe('implausible_time');
    const tooFast = emptyCells(p) * MIN_MS_PER_EMPTY_CELL - 1;
    expect((await finish(cookie, data.ticketId, p, { elapsedMs: tooFast })).data.error).toBe('implausible_time');
    expect((await finish(cookie, data.ticketId, p, { elapsedMs: 90_000 })).status).toBe(200);
  });

  it('scores a puzzle only once, and only with your own ticket', async () => {
    const { player, start, finish, play, api } = await setup();
    const alice = await player('a@example.com');
    const bob = await player('b@example.com');
    const p = puzzle('easy', 4);
    expect((await play(alice, p)).status).toBe(200);
    expect((await start(alice, p)).data.error).toBe('already_scored');

    const { data } = await start(bob, puzzle('easy', 5));
    api.clock.now += 5 * MIN;
    expect((await finish(alice, data.ticketId, puzzle('easy', 5))).data.error).toBe('ticket_not_found');
    expect((await finish(bob, data.ticketId, puzzle('easy', 5))).status).toBe(200);
    expect((await finish(bob, data.ticketId, puzzle('easy', 5))).data.error).toBe('already_scored');
  });

  it('reports the daily rank', async () => {
    const { player, play, daily } = await setup();
    const a = await player('a@example.com', 'Alice');
    const b = await player('b@example.com', 'Bob');
    expect((await play(a, daily, { elapsedMs: 5 * MIN })).data.dailyRank).toBe(1);
    expect((await play(b, daily, { elapsedMs: 4 * MIN })).data.dailyRank).toBe(1); // faster → more points
  });
});

describe('leaderboards', () => {
  async function scenario() {
    const s = await setup();
    const alice = await s.player('alice@example.com', 'Alice');
    const bob = await s.player('bob@example.com', 'Bob');
    const anon = await s.player('anon@example.com'); // no username → not listed
    await s.play(alice, puzzle('hard', 1), { elapsedMs: 15 * MIN }); // 400
    await s.play(bob, puzzle('easy', 1), { elapsedMs: 6 * MIN }); // 100
    await s.play(bob, puzzle('easy', 2), { elapsedMs: 6 * MIN }); // 100
    await s.play(anon, puzzle('expert', 1), { elapsedMs: 20 * MIN }); // 700
    return { ...s, alice, bob, anon };
  }

  it('all-time: total points, players with a username only, plus your own row', async () => {
    const { api, bob } = await scenario();
    const res = await api.call('GET', '/api/leaderboard?period=all', { cookie: bob });
    expect(res.data.entries).toEqual([
      { rank: 1, username: 'Alice', points: 400, games: 1 },
      { rank: 2, username: 'Bob', points: 200, games: 2 },
    ]);
    expect(res.data.me).toEqual({ rank: 2, username: 'Bob', points: 200, games: 2 });
    expect((await api.call('GET', '/api/leaderboard?period=all')).data.me).toBeNull();
  });

  it('weekly: only scores since Monday 00:00 UTC', async () => {
    const { api, bob, play } = await scenario();
    expect(new Date(weekStart(NOW)).toISOString()).toBe('2027-01-11T00:00:00.000Z');
    api.clock.now = Date.UTC(2027, 0, 18, 9); // next Monday
    await play(bob, puzzle('medium', 1), { elapsedMs: 10 * MIN }); // 200
    const res = await api.call('GET', '/api/leaderboard?period=week');
    expect(res.data.entries).toEqual([{ rank: 1, username: 'Bob', points: 200, games: 1 }]);
  });

  it('daily: ranked by points then time', async () => {
    const { api, alice, bob, play, daily } = await scenario();
    await play(alice, daily, { elapsedMs: 8 * MIN });
    await play(bob, daily, { elapsedMs: 5 * MIN });
    const res = await api.call('GET', '/api/leaderboard?period=daily&date=2027-01-15', { cookie: alice });
    expect(res.data.entries.map((e: { username: string }) => e.username)).toEqual(['Bob', 'Alice']);
    expect(res.data.entries[0]).toMatchObject({ rank: 1, elapsedMs: 5 * MIN });
    expect(res.data.me).toMatchObject({ rank: 2, username: 'Alice' });
    expect((await api.call('GET', '/api/leaderboard?period=daily&date=yesterday')).data.error).toBe('invalid_date');
    expect((await api.call('GET', '/api/leaderboard?period=month')).data.error).toBe('invalid_period');
  });

  it('your summary: totals, rank, bests and recent results', async () => {
    const { api, bob } = await scenario();
    const res = await api.call('GET', '/api/me/scores', { cookie: bob });
    expect(res.data).toMatchObject({ points: 200, games: 2, rank: 2, best: { easy: { points: 100, bestMs: 6 * MIN } } });
    expect(res.data.recent).toHaveLength(2);
  });

  it('deleting an account removes its scores from the leaderboard', async () => {
    const { api, alice } = await scenario();
    await api.call('DELETE', '/api/me', { cookie: alice });
    const res = await api.call('GET', '/api/leaderboard?period=all');
    expect(res.data.entries.map((e: { username: string }) => e.username)).toEqual(['Bob']);
  });
});
