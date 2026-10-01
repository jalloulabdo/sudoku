import { mulberry32, shuffle, type Rng } from './prng';
import { randomFullGrid } from './solver';
import { solveLogically, type LogicalSolveResult } from './techniques';
import type { CellValue, Difficulty, Digit, Puzzle } from './types';

export interface DifficultyProfile {
  /** The hardest technique used must be at least this level… */
  minLevel: number;
  /** …and at most this level (see TECHNIQUE_LEVEL). */
  maxLevel: number;
  minGivens: number;
  maxGivens: number;
}

export const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  easy: { minLevel: 1, maxLevel: 1, minGivens: 36, maxGivens: 45 },
  medium: { minLevel: 2, maxLevel: 2, minGivens: 30, maxGivens: 35 },
  hard: { minLevel: 3, maxLevel: 3, minGivens: 28, maxGivens: 31 },
  expert: { minLevel: 4, maxLevel: 4, minGivens: 24, maxGivens: 29 },
  master: { minLevel: 4, maxLevel: 4, minGivens: 17, maxGivens: 25 },
};

const MAX_ATTEMPTS = 2000;

/**
 * Removes givens in rotationally symmetric pairs while the puzzle stays solvable using only
 * techniques up to `maxLevel`. A puzzle solved by sound logic alone has exactly one solution,
 * so no separate uniqueness search is needed here.
 */
function carve(solution: readonly Digit[], p: DifficultyProfile, rng: Rng): Uint8Array | null {
  const board = Uint8Array.from(solution);
  let givens = 81;
  const order = shuffle(
    Array.from({ length: 41 }, (_, i) => i),
    rng,
  );
  for (const i of order) {
    const j = 80 - i;
    const cost = i === j ? 1 : 2;
    if (givens - cost < p.minGivens) continue;
    const vi = board[i];
    const vj = board[j];
    board[i] = 0;
    board[j] = 0;
    if (solveLogically(board, p.maxLevel).solved) {
      givens -= cost;
    } else {
      board[i] = vi;
      board[j] = vj;
    }
  }
  if (givens > p.maxGivens) return null;
  const rating = solveLogically(board, p.maxLevel);
  return rating.hardestLevel >= p.minLevel ? board : null;
}

export function countGivens(givens: readonly (CellValue | number)[]): number {
  return givens.filter((v) => v !== null && v !== 0).length;
}

/** Rates a puzzle; `difficulty` is null when it matches no profile (or needs techniques beyond v1). */
export function ratePuzzle(givens: readonly (CellValue | number)[]): {
  difficulty: Difficulty | null;
  givens: number;
  logic: LogicalSolveResult;
} {
  const logic = solveLogically(givens.map((v) => v ?? 0));
  const n = countGivens(givens);
  let difficulty: Difficulty | null = null;
  if (logic.solved) {
    // Check the hardest profiles first so master wins over expert when both match.
    for (const d of ['master', 'expert', 'hard', 'medium', 'easy'] as const) {
      const p = DIFFICULTY_PROFILES[d];
      if (logic.hardestLevel >= p.minLevel && logic.hardestLevel <= p.maxLevel && n >= p.minGivens && n <= p.maxGivens) {
        difficulty = d;
        break;
      }
    }
  }
  return { difficulty, givens: n, logic };
}

/** Deterministic: the same (difficulty, seed) always produces the same puzzle. */
export function generatePuzzle(difficulty: Difficulty, seed: number, id = `${difficulty}-${seed}`): Puzzle {
  const rng = mulberry32(seed);
  const profile = DIFFICULTY_PROFILES[difficulty];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const solution = randomFullGrid(rng);
    const board = carve(solution, profile, rng);
    if (!board) continue;
    return {
      id,
      givens: Array.from(board, (v) => (v === 0 ? null : (v as Digit))),
      solution,
      difficulty,
      seed,
    };
  }
  throw new Error(`Could not generate a ${difficulty} puzzle for seed ${seed}`);
}
