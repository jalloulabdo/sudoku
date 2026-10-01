import { generatePuzzleAsync } from '../logic/generatorClient';
import { dailyRequest } from '../logic/daily';
import type { Difficulty, Puzzle } from '../logic/types';
import { gameStore } from './gameStore';
import { uiStore } from './uiStore';

/** Difficulties slow enough to keep one puzzle ready in advance. */
const PREFETCHED: readonly Difficulty[] = ['master'];
const ready = new Map<Difficulty, Promise<Puzzle>>();

export function prefetch(difficulty: Difficulty): void {
  if (ready.has(difficulty)) return;
  const p = generatePuzzleAsync(difficulty, undefined, undefined, 'background');
  p.catch(() => ready.delete(difficulty));
  ready.set(difficulty, p);
}

/** Starts pre-generating slow difficulties once the app is idle. */
export function prefetchSlowDifficulties(): void {
  const start = () => PREFETCHED.forEach(prefetch);
  if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 3000 });
  else setTimeout(start, 1500);
}

async function nextPuzzle(difficulty: Difficulty): Promise<Puzzle> {
  const waiting = ready.get(difficulty);
  ready.delete(difficulty);
  let puzzle: Puzzle;
  try {
    puzzle = waiting ? await waiting : await generatePuzzleAsync(difficulty);
  } catch {
    puzzle = await generatePuzzleAsync(difficulty);
  }
  if (PREFETCHED.includes(difficulty)) prefetch(difficulty);
  return puzzle;
}

/** Shows the loading state only if generation takes longer than this. */
const LOADING_DELAY_MS = 150;

async function withLoading<T>(work: Promise<T>): Promise<T> {
  const timer = setTimeout(() => uiStore.setState({ generating: true }), LOADING_DELAY_MS);
  try {
    return await work;
  } finally {
    clearTimeout(timer);
    uiStore.setState({ generating: false });
  }
}

let latestRequest = 0;
let inFlight: { key: string; promise: Promise<void> } | null = null;

/**
 * Generates and starts a game. A request for the same game that is already loading joins it;
 * a different, newer request wins over an older one.
 */
function start(key: string, load: () => Promise<Puzzle>): Promise<void> {
  if (inFlight?.key === key) return inFlight.promise;
  const request = ++latestRequest;
  const promise = withLoading(load())
    .then((puzzle) => {
      if (request === latestRequest) gameStore.getState().newGame(puzzle);
    })
    .finally(() => {
      if (inFlight?.promise === promise) inFlight = null;
    });
  inFlight = { key, promise };
  return promise;
}

export function startNewGame(difficulty: Difficulty): Promise<void> {
  return start(difficulty, () => nextPuzzle(difficulty));
}

export function startDailyGame(key: string): Promise<void> {
  const { difficulty, seed, id } = dailyRequest(key);
  return start(id, () => generatePuzzleAsync(difficulty, seed, id));
}
