import { addDays } from '../src/logic/daily';
import { matchesDifficulty } from '../src/logic/generator';
import { MIN_MS_PER_EMPTY_CELL, computePoints } from '../src/logic/points';
import { countSolutions } from '../src/logic/solver';
import { DIFFICULTIES, type Difficulty } from '../src/logic/types';
import { currentUser, requireUser } from './auth';
import { randomToken, sha256 } from './crypto';
import type { Ctx } from './env';
import { rateLimit } from './guards';
import { HttpError, json, readJson } from './http';

const HOUR = 60 * 60 * 1000;
/** Allowance for clock and network jitter between the client's timer and the server's clock. */
const CLOCK_SLACK_MS = 5000;
const LEADERBOARD_SIZE = 50;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const isDifficulty = (v: unknown): v is Difficulty => DIFFICULTIES.includes(v as Difficulty);
const isCount = (v: unknown, max: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;
const utcDateKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Fingerprints of the official daily puzzles, generated at build time (see vite.config.ts). */
async function dailyIndex(ctx: Ctx): Promise<Record<string, string>> {
  if (!ctx.env.ASSETS) return {};
  const res = await ctx.env.ASSETS.fetch(new URL('/daily-index.json', ctx.url).toString());
  return res.ok ? ((await res.json()) as Record<string, string>) : {};
}

interface TicketRow {
  id: string;
  user_id: string;
  puzzle_id: string;
  difficulty: Difficulty;
  givens: string;
  daily_key: string | null;
  started_at: number;
  finished_at: number | null;
}

/**
 * POST /api/games/start — { puzzleId, difficulty, givens } → { ticketId }.
 * The puzzle must be valid, have a single solution and really be of the claimed difficulty;
 * a daily puzzle must be that day's official one.
 */
export async function startGame(ctx: Ctx): Promise<Response> {
  const user = await requireUser(ctx);
  const body = await readJson<{ puzzleId?: unknown; difficulty?: unknown; givens?: unknown }>(ctx.request);
  const { puzzleId, difficulty, givens } = body;
  if (typeof puzzleId !== 'string' || puzzleId.length > 64 || !isDifficulty(difficulty) || typeof givens !== 'string' || !/^[0-9]{81}$/.test(givens)) {
    throw new HttpError(400, 'invalid_puzzle');
  }
  const db = ctx.env.DB;
  if (!(await rateLimit(db, `games:start:${user.id}`, 300, HOUR, ctx.now))) throw new HttpError(429, 'rate_limited');

  const already = await db.prepare('SELECT 1 FROM scores WHERE user_id = ? AND puzzle_id = ?').bind(user.id, puzzleId).first();
  if (already) throw new HttpError(409, 'already_scored');
  const open = await db
    .prepare('SELECT id FROM game_tickets WHERE user_id = ? AND puzzle_id = ? AND givens = ? AND finished_at IS NULL')
    .bind(user.id, puzzleId, givens)
    .first<{ id: string }>();
  if (open) return json({ ticketId: open.id }); // e.g. the page was reloaded

  const grid = [...givens].map(Number);
  if (countSolutions(grid) !== 1 || !matchesDifficulty(grid, difficulty)) throw new HttpError(400, 'invalid_puzzle');

  let dailyKey: string | null = null;
  const daily = /^daily-(\d{4}-\d{2}-\d{2})$/.exec(puzzleId);
  if (daily) {
    if ((await dailyIndex(ctx))[daily[1]] !== (await sha256(givens))) throw new HttpError(400, 'invalid_puzzle');
    // Players' local dates differ by up to a day from UTC; older dailies still score, but outside the daily ranking.
    const today = utcDateKey(ctx.now);
    if (daily[1] >= addDays(today, -1) && daily[1] <= addDays(today, 1)) dailyKey = daily[1];
  }

  const id = randomToken(16);
  await db
    .prepare('INSERT INTO game_tickets (id, user_id, puzzle_id, difficulty, givens, daily_key, started_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, puzzleId, difficulty, givens, dailyKey, ctx.now)
    .run();
  return json({ ticketId: id, daily: dailyKey !== null });
}

function isValidSolution(givens: string, solution: string): boolean {
  if (!/^[1-9]{81}$/.test(solution)) return false;
  for (let i = 0; i < 81; i++) if (givens[i] !== '0' && givens[i] !== solution[i]) return false;
  for (let u = 0; u < 9; u++) {
    const row = new Set<string>();
    const col = new Set<string>();
    const box = new Set<string>();
    for (let k = 0; k < 9; k++) {
      row.add(solution[u * 9 + k]);
      col.add(solution[k * 9 + u]);
      box.add(solution[(Math.floor(u / 3) * 3 + Math.floor(k / 3)) * 9 + (u % 3) * 3 + (k % 3)]);
    }
    if (row.size !== 9 || col.size !== 9 || box.size !== 9) return false;
  }
  return true;
}

/** Rank of `points` (and time, for dailies) among a day's daily scores. */
async function dailyRank(ctx: Ctx, dailyKey: string, points: number, elapsedMs: number): Promise<number> {
  const row = await ctx.env.DB.prepare(
    'SELECT COUNT(*) + 1 AS rank FROM scores WHERE daily_key = ? AND (points > ? OR (points = ? AND elapsed_ms < ?))',
  )
    .bind(dailyKey, points, points, elapsedMs)
    .first<{ rank: number }>();
  return row?.rank ?? 1;
}

/** POST /api/games/finish — { ticketId, solution, elapsedMs, mistakes, hints } → points awarded. */
export async function finishGame(ctx: Ctx): Promise<Response> {
  const user = await requireUser(ctx);
  const body = await readJson<{ ticketId?: unknown; solution?: unknown; elapsedMs?: unknown; mistakes?: unknown; hints?: unknown }>(ctx.request);
  const db = ctx.env.DB;
  const ticket =
    typeof body.ticketId === 'string'
      ? await db.prepare('SELECT * FROM game_tickets WHERE id = ? AND user_id = ?').bind(body.ticketId, user.id).first<TicketRow>()
      : null;
  if (!ticket) throw new HttpError(404, 'ticket_not_found');
  if (ticket.finished_at !== null) throw new HttpError(409, 'already_scored');

  if (typeof body.solution !== 'string' || !isValidSolution(ticket.givens, body.solution)) throw new HttpError(400, 'wrong_solution');
  if (!isCount(body.elapsedMs, 7 * 24 * HOUR) || !isCount(body.mistakes, 99) || !isCount(body.hints, 81)) {
    throw new HttpError(400, 'invalid_result');
  }
  // The timer excludes pauses, so it can only be shorter than the time since the ticket was issued.
  const emptyCells = [...ticket.givens].filter((c) => c === '0').length;
  if (body.elapsedMs > ctx.now - ticket.started_at + CLOCK_SLACK_MS || body.elapsedMs < emptyCells * MIN_MS_PER_EMPTY_CELL) {
    throw new HttpError(400, 'implausible_time');
  }

  const breakdown = computePoints(ticket.difficulty, body.elapsedMs, body.mistakes, body.hints);
  try {
    await db.batch([
      db.prepare('UPDATE game_tickets SET finished_at = ? WHERE id = ?').bind(ctx.now, ticket.id),
      db
        .prepare(
          `INSERT INTO scores (id, user_id, ticket_id, puzzle_id, difficulty, daily_key, elapsed_ms, mistakes, hints, points, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(randomToken(16), user.id, ticket.id, ticket.puzzle_id, ticket.difficulty, ticket.daily_key, body.elapsedMs, body.mistakes, body.hints, breakdown.points, ctx.now),
    ]);
  } catch {
    throw new HttpError(409, 'already_scored'); // UNIQUE(user_id, puzzle_id) from a parallel ticket
  }
  return json({
    ...breakdown,
    dailyRank: ticket.daily_key ? await dailyRank(ctx, ticket.daily_key, breakdown.points, body.elapsedMs) : null,
  });
}

/** Monday 00:00 UTC of the week containing `ms`. */
export function weekStart(ms: number): number {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

interface RankedRow {
  user_id: string;
  username: string;
  points: number;
  games?: number;
  elapsed_ms?: number;
  rank: number;
}

const toEntry = (r: RankedRow) => ({
  rank: r.rank,
  username: r.username,
  points: r.points,
  ...(r.games !== undefined ? { games: r.games } : {}),
  ...(r.elapsed_ms !== undefined ? { elapsedMs: r.elapsed_ms } : {}),
});

/** GET /api/leaderboard?period=all|week|daily[&date=YYYY-MM-DD] — top players, plus your own row when signed in. */
export async function leaderboard(ctx: Ctx): Promise<Response> {
  const period = ctx.url.searchParams.get('period') ?? 'all';
  const db = ctx.env.DB;
  let ranked: string;
  let params: unknown[];
  let date: string | null = null;

  if (period === 'all' || period === 'week') {
    const since = period === 'week' ? weekStart(ctx.now) : 0;
    ranked = `SELECT s.user_id, u.username, SUM(s.points) AS points, COUNT(*) AS games,
                RANK() OVER (ORDER BY SUM(s.points) DESC) AS rank
              FROM scores s JOIN users u ON u.id = s.user_id
              WHERE u.username IS NOT NULL AND s.created_at >= ?
              GROUP BY s.user_id`;
    params = [since];
  } else if (period === 'daily') {
    date = ctx.url.searchParams.get('date') ?? utcDateKey(ctx.now);
    if (!DATE_KEY.test(date)) throw new HttpError(400, 'invalid_date');
    ranked = `SELECT s.user_id, u.username, s.points, s.elapsed_ms,
                RANK() OVER (ORDER BY s.points DESC, s.elapsed_ms ASC) AS rank
              FROM scores s JOIN users u ON u.id = s.user_id
              WHERE u.username IS NOT NULL AND s.daily_key = ?`;
    params = [date];
  } else {
    throw new HttpError(400, 'invalid_period');
  }

  const top = await db
    .prepare(`WITH ranked AS (${ranked}) SELECT * FROM ranked ORDER BY rank, username LIMIT ${LEADERBOARD_SIZE}`)
    .bind(...params)
    .all<RankedRow>();
  const user = await currentUser(ctx);
  const me = user
    ? await db.prepare(`WITH ranked AS (${ranked}) SELECT * FROM ranked WHERE user_id = ?`).bind(...params, user.id).first<RankedRow>()
    : null;

  return json({ period, date, entries: top.results.map(toEntry), me: me ? toEntry(me) : null });
}

/** GET /api/me/scores — your totals, all-time rank, best per difficulty and recent results. */
export async function myScores(ctx: Ctx): Promise<Response> {
  const user = await requireUser(ctx);
  const db = ctx.env.DB;
  const totals = await db
    .prepare('SELECT COALESCE(SUM(points), 0) AS points, COUNT(*) AS games FROM scores WHERE user_id = ?')
    .bind(user.id)
    .first<{ points: number; games: number }>();
  const rank =
    user.username && totals && totals.games > 0
      ? await db
          .prepare(
            `SELECT COUNT(*) + 1 AS rank FROM (
               SELECT SUM(s.points) AS total FROM scores s JOIN users u ON u.id = s.user_id
               WHERE u.username IS NOT NULL GROUP BY s.user_id
             ) WHERE total > ?`,
          )
          .bind(totals.points)
          .first<{ rank: number }>()
      : null;
  const best = await db
    .prepare('SELECT difficulty, MAX(points) AS points, MIN(elapsed_ms) AS best_ms FROM scores WHERE user_id = ? GROUP BY difficulty')
    .bind(user.id)
    .all<{ difficulty: Difficulty; points: number; best_ms: number }>();
  const recent = await db
    .prepare('SELECT difficulty, points, elapsed_ms, daily_key, created_at FROM scores WHERE user_id = ? ORDER BY created_at DESC LIMIT 10')
    .bind(user.id)
    .all<{ difficulty: Difficulty; points: number; elapsed_ms: number; daily_key: string | null; created_at: number }>();

  return json({
    points: totals?.points ?? 0,
    games: totals?.games ?? 0,
    rank: rank?.rank ?? null,
    best: Object.fromEntries(best.results.map((b) => [b.difficulty, { points: b.points, bestMs: b.best_ms }])),
    recent: recent.results.map((r) => ({
      difficulty: r.difficulty,
      points: r.points,
      elapsedMs: r.elapsed_ms,
      daily: r.daily_key,
      createdAt: r.created_at,
    })),
  });
}
