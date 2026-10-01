import { ALL_DIGITS, BOX_OF, COL_OF, ROW_OF, bit, popcount } from './board';
import { shuffle, type Rng } from './prng';
import type { CellValue, Digit } from './types';

/** Any 81-length grid where empty cells are 0 or null. */
export type GridInput = ArrayLike<number | CellValue>;

interface SearchState {
  board: Uint8Array;
  rows: Uint16Array;
  cols: Uint16Array;
  boxes: Uint16Array;
}

/** Builds the search state, or returns null if the grid breaks a Sudoku rule. */
function prepare(grid: GridInput): SearchState | null {
  if (grid.length !== 81) return null;
  const s: SearchState = {
    board: new Uint8Array(81),
    rows: new Uint16Array(9),
    cols: new Uint16Array(9),
    boxes: new Uint16Array(9),
  };
  for (let i = 0; i < 81; i++) {
    const v = grid[i] ?? 0;
    if (v === 0) continue;
    if (!Number.isInteger(v) || v < 1 || v > 9) return null;
    const m = bit(v);
    if ((s.rows[ROW_OF[i]] | s.cols[COL_OF[i]] | s.boxes[BOX_OF[i]]) & m) return null;
    s.board[i] = v;
    s.rows[ROW_OF[i]] |= m;
    s.cols[COL_OF[i]] |= m;
    s.boxes[BOX_OF[i]] |= m;
  }
  return s;
}

interface SearchResult {
  count: number;
  first: Uint8Array | null;
}

/** Backtracking with minimum-remaining-values cell choice. Stops once `limit` solutions are found. */
function search(s: SearchState, limit: number, rng: Rng | undefined, out: SearchResult): void {
  let best = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (s.board[i] !== 0) continue;
    const mask = ALL_DIGITS & ~(s.rows[ROW_OF[i]] | s.cols[COL_OF[i]] | s.boxes[BOX_OF[i]]);
    const n = popcount(mask);
    if (n === 0) return; // dead end
    if (n < bestCount) {
      best = i;
      bestMask = mask;
      bestCount = n;
      if (n === 1) break;
    }
  }

  if (best === -1) {
    out.count++;
    if (!out.first) out.first = s.board.slice();
    return;
  }

  const digits: number[] = [];
  for (let d = 1; d <= 9; d++) if (bestMask & bit(d)) digits.push(d);
  if (rng) shuffle(digits, rng);

  const r = ROW_OF[best];
  const c = COL_OF[best];
  const b = BOX_OF[best];
  for (const d of digits) {
    const m = bit(d);
    s.board[best] = d;
    s.rows[r] |= m;
    s.cols[c] |= m;
    s.boxes[b] |= m;
    search(s, limit, rng, out);
    s.board[best] = 0;
    s.rows[r] &= ~m;
    s.cols[c] &= ~m;
    s.boxes[b] &= ~m;
    if (out.count >= limit) return;
  }
}

/**
 * Solves a grid. Returns the first solution found, or null if the grid is invalid or unsolvable.
 * Pass an `rng` to randomise digit order (used to build random full grids).
 */
export function solve(grid: GridInput, rng?: Rng): Digit[] | null {
  const s = prepare(grid);
  if (!s) return null;
  const out: SearchResult = { count: 0, first: null };
  search(s, 1, rng, out);
  return out.first ? (Array.from(out.first) as Digit[]) : null;
}

/** Counts solutions, stopping early at `limit`. 0 for an invalid grid. */
export function countSolutions(grid: GridInput, limit = 2): number {
  const s = prepare(grid);
  if (!s) return 0;
  const out: SearchResult = { count: 0, first: null };
  search(s, limit, undefined, out);
  return out.count;
}

export function hasUniqueSolution(grid: GridInput): boolean {
  return countSolutions(grid, 2) === 1;
}

/** A random, complete, valid grid. */
export function randomFullGrid(rng: Rng): Digit[] {
  const grid = solve(new Array<number>(81).fill(0), rng);
  if (!grid) throw new Error('unreachable: empty grid is always solvable');
  return grid;
}
