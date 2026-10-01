import { hashString } from './prng';
import type { Difficulty } from './types';

/** Indexed by Date#getDay(): Sunday = 0. */
const WEEKDAY_DIFFICULTY: readonly Difficulty[] = ['expert', 'easy', 'medium', 'hard', 'medium', 'hard', 'expert'];

/** Local-time `YYYY-MM-DD`. */
export function dateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(key: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new Error(`Invalid date key: ${key}`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function dailySeed(key: string): number {
  return hashString(`daily-${key}`);
}

export function dailyDifficulty(key: string): Difficulty {
  return WEEKDAY_DIFFICULTY[parseDateKey(key).getDay()];
}

export function dailyPuzzleId(key: string): string {
  return `daily-${key}`;
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  return dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

/**
 * Current streak: consecutive completed days ending today (or yesterday, so the streak
 * isn't shown as broken before today's puzzle is played). Best: longest run ever.
 */
export function dailyStreaks(completed: readonly string[], today: string): { current: number; best: number } {
  const done = new Set(completed);
  let current = 0;
  let day = done.has(today) ? today : addDays(today, -1);
  while (done.has(day)) {
    current++;
    day = addDays(day, -1);
  }
  let best = 0;
  for (const key of done) {
    if (done.has(addDays(key, -1))) continue; // not the start of a run
    let run = 0;
    for (let d = key; done.has(d); d = addDays(d, 1)) run++;
    best = Math.max(best, run);
  }
  return { current, best };
}

/** Everything needed to generate a day's puzzle (via the worker or directly). */
export function dailyRequest(key: string): { difficulty: Difficulty; seed: number; id: string } {
  return { difficulty: dailyDifficulty(key), seed: dailySeed(key), id: dailyPuzzleId(key) };
}
