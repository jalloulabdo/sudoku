import type { Difficulty } from './types';

/** Points for solving a puzzle with no mistakes or hints, before the time bonus. */
export const BASE_POINTS: Record<Difficulty, number> = { easy: 100, medium: 200, hard: 400, expert: 700, master: 1000 };

/** Solving faster than this earns a time bonus, growing to +50% for an instant solve. */
export const PAR_MS: Record<Difficulty, number> = {
  easy: 6 * 60_000,
  medium: 10 * 60_000,
  hard: 15 * 60_000,
  expert: 20 * 60_000,
  master: 30 * 60_000,
};

export const MISTAKE_PENALTY = 0.1; // of base points, per mistake
export const HINT_PENALTY = 0.15; // of base points, per hint
export const MIN_SHARE = 0.1; // a solved puzzle is always worth at least 10% of its base

export interface PointsBreakdown {
  base: number;
  timeBonus: number;
  penalty: number;
  points: number;
}

/** Shared by the server (which awards points) and the client (which explains them). */
export function computePoints(difficulty: Difficulty, elapsedMs: number, mistakes: number, hints: number): PointsBreakdown {
  const base = BASE_POINTS[difficulty];
  const par = PAR_MS[difficulty];
  const timeBonus = Math.round(base * 0.5 * Math.min(1, Math.max(0, (par - elapsedMs) / par)));
  const penalty = Math.round(base * (MISTAKE_PENALTY * mistakes + HINT_PENALTY * hints));
  const points = Math.max(Math.round(base * MIN_SHARE), base + timeBonus - penalty);
  return { base, timeBonus, penalty, points };
}

/** A human can't fill cells faster than this; faster claimed times are rejected. */
export const MIN_MS_PER_EMPTY_CELL = 250;

/** Givens as an 81-character string, '0' for empty cells (the format the API uses). */
export const gridToString = (cells: readonly (number | null)[]) => cells.map((v) => v ?? 0).join('');
