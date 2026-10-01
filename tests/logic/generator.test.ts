import { DIFFICULTY_PROFILES, countGivens, generatePuzzle, ratePuzzle } from '../../src/logic/generator';
import { dailyDifficulty, dailyRequest, dateKey } from '../../src/logic/daily';
import { hashString, mulberry32 } from '../../src/logic/prng';
import { countSolutions } from '../../src/logic/solver';
import type { Difficulty } from '../../src/logic/types';

const SEEDS = Array.from({ length: 20 }, (_, i) => hashString(`seed-${i}`));
const TESTED: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

describe('generatePuzzle', () => {
  for (const difficulty of TESTED) {
    it(`builds unique ${difficulty} puzzles that match their profile (20 seeds)`, () => {
      const p = DIFFICULTY_PROFILES[difficulty];
      for (const seed of SEEDS) {
        const puzzle = generatePuzzle(difficulty, seed);
        expect(puzzle.id).toBe(`${difficulty}-${seed}`);
        expect(countSolutions(puzzle.givens)).toBe(1);

        const n = countGivens(puzzle.givens);
        expect(n).toBeGreaterThanOrEqual(p.minGivens);
        expect(n).toBeLessThanOrEqual(p.maxGivens);

        const rating = ratePuzzle(puzzle.givens);
        expect(rating.logic.solved).toBe(true);
        expect(rating.logic.hardestLevel).toBeGreaterThanOrEqual(p.minLevel);
        expect(rating.logic.hardestLevel).toBeLessThanOrEqual(p.maxLevel);
        expect(Array.from(rating.logic.values)).toEqual(puzzle.solution);

        puzzle.givens.forEach((v, i) => v !== null && expect(v).toBe(puzzle.solution[i]));
        // Rotational symmetry.
        puzzle.givens.forEach((v, i) => expect(v === null).toBe(puzzle.givens[80 - i] === null));
      }
    });
  }

  it('builds master puzzles', () => {
    for (const seed of SEEDS.slice(0, 3)) {
      const puzzle = generatePuzzle('master', seed);
      expect(countSolutions(puzzle.givens)).toBe(1);
      expect(ratePuzzle(puzzle.givens).difficulty).toBe('master');
    }
  });

  it('is deterministic per seed', () => {
    expect(generatePuzzle('hard', 12345)).toEqual(generatePuzzle('hard', 12345));
    expect(generatePuzzle('hard', 12345).givens).not.toEqual(generatePuzzle('hard', 12346).givens);
  });

  it('generates expert puzzles in under 1 s on average', () => {
    const rng = mulberry32(99);
    const runs = 10;
    const start = performance.now();
    for (let i = 0; i < runs; i++) generatePuzzle('expert', Math.floor(rng() * 2 ** 32));
    const avg = (performance.now() - start) / runs;
    console.info(`expert generation: ${avg.toFixed(0)} ms average`);
    expect(avg).toBeLessThan(1000);
  });
});

describe('daily puzzle', () => {
  it('formats local dates', () => {
    expect(dateKey(new Date(2026, 8, 30))).toBe('2026-09-30');
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('rotates difficulty by weekday', () => {
    expect(dailyDifficulty('2026-09-28')).toBe('easy'); // Monday
    expect(dailyDifficulty('2026-10-03')).toBe('expert'); // Saturday
  });

  it('gives the same puzzle for the same day and different puzzles for different days', () => {
    const a = dailyRequest('2026-09-30');
    expect(dailyRequest('2026-09-30')).toEqual(a);
    expect(a.id).toBe('daily-2026-09-30');
    const p = generatePuzzle(a.difficulty, a.seed, a.id);
    expect(p.id).toBe('daily-2026-09-30');
    expect(generatePuzzle(a.difficulty, a.seed, a.id)).toEqual(p);
    expect(dailyRequest('2026-10-01').seed).not.toBe(a.seed);
  });

  it('rejects malformed keys', () => {
    expect(() => dailyDifficulty('30/09/2026')).toThrow();
  });
});
