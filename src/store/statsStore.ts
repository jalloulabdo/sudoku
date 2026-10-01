import { createStore } from 'zustand/vanilla';
import { DIFFICULTIES, type Difficulty } from '../logic/types';
import { isObject } from '../storage/storage';

export interface DifficultyStats {
  started: number;
  won: number;
  bestMs: number | null;
  totalWonMs: number;
}

export interface StatsData {
  byDifficulty: Record<Difficulty, DifficultyStats>;
  /** `YYYY-MM-DD` keys of completed daily puzzles, sorted. */
  dailyCompleted: string[];
}

export const STATS_VERSION = 1;

const emptyDifficulty = (): DifficultyStats => ({ started: 0, won: 0, bestMs: null, totalWonMs: 0 });

export function emptyStats(): StatsData {
  return {
    byDifficulty: Object.fromEntries(DIFFICULTIES.map((d) => [d, emptyDifficulty()])) as Record<
      Difficulty,
      DifficultyStats
    >,
    dailyCompleted: [],
  };
}

export interface StatsStore extends StatsData {
  recordStart(difficulty: Difficulty): void;
  recordWin(difficulty: Difficulty, elapsedMs: number): void;
  recordDailyComplete(key: string): void;
  reset(): void;
}

export const statsStore = createStore<StatsStore>()((set) => {
  const updateDifficulty = (difficulty: Difficulty, fn: (s: DifficultyStats) => DifficultyStats) =>
    set((state) => ({ byDifficulty: { ...state.byDifficulty, [difficulty]: fn(state.byDifficulty[difficulty]) } }));

  return {
    ...emptyStats(),
    recordStart: (difficulty) => updateDifficulty(difficulty, (s) => ({ ...s, started: s.started + 1 })),
    recordWin: (difficulty, elapsedMs) =>
      updateDifficulty(difficulty, (s) => ({
        ...s,
        won: s.won + 1,
        bestMs: s.bestMs === null ? elapsedMs : Math.min(s.bestMs, elapsedMs),
        totalWonMs: s.totalWonMs + elapsedMs,
      })),
    recordDailyComplete: (key) =>
      set((state) =>
        state.dailyCompleted.includes(key) ? state : { dailyCompleted: [...state.dailyCompleted, key].sort() },
      ),
    reset: () => set(emptyStats()),
  };
});

export function selectStats(s: StatsStore): StatsData {
  return { byDifficulty: s.byDifficulty, dailyCompleted: s.dailyCompleted };
}

export const winRate = (s: DifficultyStats): number => (s.started === 0 ? 0 : s.won / s.started);
export const averageMs = (s: DifficultyStats): number | null => (s.won === 0 ? null : s.totalWonMs / s.won);

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

export function validateStats(data: unknown): StatsData | null {
  if (!isObject(data) || !isObject(data.byDifficulty)) return null;
  const out = emptyStats();
  for (const d of DIFFICULTIES) {
    const s = data.byDifficulty[d];
    if (!isObject(s)) continue;
    if (!isCount(s.started) || !isCount(s.won) || !isCount(s.totalWonMs)) continue;
    if (s.bestMs !== null && !isCount(s.bestMs)) continue;
    out.byDifficulty[d] = { started: s.started, won: s.won, bestMs: s.bestMs as number | null, totalWonMs: s.totalWonMs };
  }
  if (Array.isArray(data.dailyCompleted)) {
    out.dailyCompleted = data.dailyCompleted.filter((k): k is string => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k));
  }
  return out;
}
