import type { Digit, Puzzle } from '../../src/logic/types';
import { gameStore } from '../../src/store/gameStore';
import { settingsStore } from '../../src/store/settingsStore';
import { statsStore } from '../../src/store/statsStore';
import { CLASSIC, CLASSIC_SOLUTION } from '../logic/fixtures';

export function classicPuzzle(id = 'easy-1'): Puzzle {
  return {
    id,
    givens: CLASSIC.map((v) => (v === 0 ? null : (v as Digit))),
    solution: CLASSIC_SOLUTION as Digit[],
    difficulty: 'easy',
    seed: 1,
  };
}

export const EMPTY_CELLS = CLASSIC.flatMap((v, i) => (v === 0 ? [i] : []));
export const solutionAt = (i: number) => CLASSIC_SOLUTION[i] as Digit;
export const wrongAt = (i: number) => ((CLASSIC_SOLUTION[i] % 9) + 1) as Digit;

export function resetStores(): void {
  gameStore.setState({ game: null, activeHint: null });
  settingsStore.getState().reset();
  statsStore.getState().reset();
}

/** In-memory Storage for Node tests. */
export class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  failWrites = false;
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.map.set(key, value);
  }
}
