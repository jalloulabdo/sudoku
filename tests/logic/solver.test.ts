import { countSolutions, hasUniqueSolution, randomFullGrid, solve } from '../../src/logic/solver';
import { mulberry32 } from '../../src/logic/prng';
import { CLASSIC, CLASSIC_SOLUTION, SEVENTEEN } from './fixtures';

function isValidComplete(grid: number[]): boolean {
  for (let u = 0; u < 9; u++) {
    const row = new Set<number>();
    const col = new Set<number>();
    const box = new Set<number>();
    for (let k = 0; k < 9; k++) {
      row.add(grid[u * 9 + k]);
      col.add(grid[k * 9 + u]);
      box.add(grid[(Math.floor(u / 3) * 3 + Math.floor(k / 3)) * 9 + (u % 3) * 3 + (k % 3)]);
    }
    for (const set of [row, col, box]) if (set.size !== 9 || set.has(0)) return false;
  }
  return true;
}

describe('solve', () => {
  it('solves a classic puzzle', () => {
    expect(solve(CLASSIC)).toEqual(CLASSIC_SOLUTION);
  });

  it('solves a 17-clue puzzle and keeps its givens', () => {
    const solution = solve(SEVENTEEN)!;
    expect(solution).not.toBeNull();
    expect(isValidComplete(solution)).toBe(true);
    SEVENTEEN.forEach((v, i) => v && expect(solution[i]).toBe(v));
  });

  it('accepts null for empty cells', () => {
    expect(solve(CLASSIC.map((v) => (v === 0 ? null : v)))).toEqual(CLASSIC_SOLUTION);
  });

  it('returns null for a grid that breaks the rules', () => {
    const bad = CLASSIC.slice();
    bad[2] = 5; // second 5 in row 1
    expect(solve(bad)).toBeNull();
  });

  it('returns null for an unsolvable grid', () => {
    // Row 1 holds 1–8, and column 9 already has a 9 → R1C9 has no candidate.
    const grid = new Array(81).fill(0);
    [1, 2, 3, 4, 5, 6, 7, 8].forEach((d, c) => (grid[c] = d));
    grid[9 * 5 + 8] = 9;
    expect(solve(grid)).toBeNull();
  });
});

describe('countSolutions', () => {
  it('finds exactly one solution for proper puzzles', () => {
    expect(countSolutions(CLASSIC)).toBe(1);
    expect(countSolutions(SEVENTEEN)).toBe(1);
    expect(hasUniqueSolution(SEVENTEEN)).toBe(true);
  });

  it('detects multiple solutions', () => {
    const loose = SEVENTEEN.slice();
    loose[loose.findIndex((v) => v !== 0)] = 0; // 16 clues can never be unique
    expect(countSolutions(loose)).toBe(2);
    expect(countSolutions(new Array(81).fill(0), 5)).toBe(5);
  });

  it('returns 0 for invalid grids', () => {
    const bad = CLASSIC.slice();
    bad[2] = 5;
    expect(countSolutions(bad)).toBe(0);
  });
});

describe('randomFullGrid', () => {
  it('builds valid grids, deterministic per seed', () => {
    const a = randomFullGrid(mulberry32(42));
    expect(isValidComplete(a)).toBe(true);
    expect(randomFullGrid(mulberry32(42))).toEqual(a);
    expect(randomFullGrid(mulberry32(43))).not.toEqual(a);
  });
});
