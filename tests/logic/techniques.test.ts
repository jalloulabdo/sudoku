import { bit } from '../../src/logic/board';
import { generatePuzzle } from '../../src/logic/generator';
import {
  applyHint,
  candidatesFromValues,
  findNextStep,
  getHint,
  solveLogically,
  type CandidateState,
} from '../../src/logic/techniques';
import type { CellState, Difficulty, Digit, Hint } from '../../src/logic/types';
import {
  CLASSIC,
  CLASSIC_SOLUTION,
  colCells,
  openState,
  removeCandidates,
  rowCells,
  setCandidates,
} from './fixtures';

const except = (cells: number[], ...skip: number[]) => cells.filter((c) => !skip.includes(c));
const elimSet = (h: Hint) => new Set(h.eliminations!.map((e) => `${e.index}:${e.digit}`));
const pairs = (cells: number[], digits: number[]) =>
  new Set(cells.flatMap((c) => digits.map((d) => `${c}:${d}`)));

// Each fixture is a hand-made candidate grid where the technique under test is the
// easiest step available, so findNextStep must return exactly it.
describe('techniques (next step on hand-made fixtures)', () => {
  it('naked single', () => {
    const s = openState();
    setCandidates(s, 40, [5]);
    const h = findNextStep(s)!;
    expect(h.technique).toBe('nakedSingle');
    expect(h.placement).toEqual({ index: 40, digit: 5 });
    expect(h.i18nParams).toMatchObject({ cell: 'R5C5', digit: 5 });
  });

  it('hidden single (box)', () => {
    const s = openState();
    removeCandidates(s, [1, 2, 9, 10, 11, 18, 19, 20], [5]); // box 1: 5 only fits R1C1
    const h = findNextStep(s)!;
    expect(h.technique).toBe('hiddenSingle');
    expect(h.placement).toEqual({ index: 0, digit: 5 });
    expect(h.i18nParams).toMatchObject({ context: 'box', unit: 1 });
  });

  it('pointing pair', () => {
    const s = openState();
    removeCandidates(s, [2, 9, 10, 11, 18, 19, 20], [5]); // box 1: 5 only in R1C1, R1C2
    const h = findNextStep(s)!;
    expect(h.technique).toBe('pointing');
    expect(h.focusCells).toEqual([0, 1]);
    expect(elimSet(h)).toEqual(pairs([3, 4, 5, 6, 7, 8], [5]));
    expect(h.i18nParams).toMatchObject({ box: 1, context: 'row', unit: 1, size: 2 });
  });

  it('claiming (box/line reduction)', () => {
    const s = openState();
    removeCandidates(s, [2, 3, 4, 5, 6, 7, 8], [5]); // row 1: 5 only in R1C1, R1C2
    const h = findNextStep(s)!;
    expect(h.technique).toBe('claiming');
    expect(elimSet(h)).toEqual(pairs([9, 10, 11, 18, 19, 20], [5]));
    expect(h.i18nParams).toMatchObject({ box: 1, context: 'row', unit: 1 });
  });

  it('naked pair', () => {
    const s = openState();
    setCandidates(s, 0, [1, 2]);
    setCandidates(s, 3, [1, 2]);
    const h = findNextStep(s)!;
    expect(h.technique).toBe('nakedPair');
    expect(h.focusCells).toEqual([0, 3]);
    expect(elimSet(h)).toEqual(pairs(except(rowCells(0), 0, 3), [1, 2]));
    expect(h.i18nParams).toMatchObject({ cells: 'R1C1, R1C4', digits: '1, 2', context: 'row', unit: 1 });
  });

  it('hidden pair', () => {
    const s = openState();
    removeCandidates(s, except(rowCells(0), 0, 3), [1, 2]);
    const h = findNextStep(s)!;
    expect(h.technique).toBe('hiddenPair');
    expect(h.focusCells).toEqual([0, 3]);
    expect(elimSet(h)).toEqual(pairs([0, 3], [3, 4, 5, 6, 7, 8, 9]));
  });

  it('naked triple', () => {
    const s = openState();
    setCandidates(s, 0, [1, 2]);
    setCandidates(s, 3, [2, 3]);
    setCandidates(s, 6, [1, 3]);
    const h = findNextStep(s)!;
    expect(h.technique).toBe('nakedTriple');
    expect(h.focusCells).toEqual([0, 3, 6]);
    expect(elimSet(h)).toEqual(pairs(except(rowCells(0), 0, 3, 6), [1, 2, 3]));
  });

  it('hidden triple', () => {
    const s = openState();
    removeCandidates(s, except(rowCells(0), 0, 3, 6), [1, 2, 3]);
    const h = findNextStep(s)!;
    expect(h.technique).toBe('hiddenTriple');
    expect(h.focusCells).toEqual([0, 3, 6]);
    expect(elimSet(h)).toEqual(pairs([0, 3, 6], [4, 5, 6, 7, 8, 9]));
  });

  it('x-wing', () => {
    const s = openState();
    // Rows 2 and 8: digit 5 only in columns 2 and 8.
    removeCandidates(s, except(rowCells(1), 10, 16), [5]);
    removeCandidates(s, except(rowCells(7), 64, 70), [5]);
    const h = findNextStep(s)!;
    expect(h.technique).toBe('xWing');
    expect(h.focusCells).toEqual([10, 16, 64, 70]);
    expect(elimSet(h)).toEqual(pairs([...except(colCells(1), 10, 64), ...except(colCells(7), 16, 70)], [5]));
    expect(h.i18nParams).toMatchObject({ digit: 5, context: 'row', lines: '2, 8', crossLines: '2, 8' });
  });

  it('xy-wing', () => {
    const s = openState();
    setCandidates(s, 0, [1, 2]); // pivot R1C1
    setCandidates(s, 3, [1, 3]); // wing R1C4
    setCandidates(s, 27, [2, 3]); // wing R4C1
    const h = findNextStep(s)!;
    expect(h.technique).toBe('xyWing');
    expect(h.focusCells).toEqual([0, 3, 27]);
    expect(h.eliminations).toEqual([{ index: 30, digit: 3 }]); // R4C4 sees both wings
  });

  it('returns null when nothing applies', () => {
    expect(findNextStep(openState())).toBeNull();
  });

  it('respects maxLevel', () => {
    const s = openState();
    setCandidates(s, 0, [1, 2]);
    setCandidates(s, 3, [1, 2]);
    expect(findNextStep(s, 2)).toBeNull();
  });
});

/** Replays a logical solve and checks every step against the known solution. */
function assertSoundSteps(givens: number[], solution: readonly number[]): void {
  const s: CandidateState = candidatesFromValues(givens);
  for (let step = 0; step < 500; step++) {
    const h = findNextStep(s);
    if (!h) return;
    if (h.placement) expect(h.placement.digit, `${h.technique} placement`).toBe(solution[h.placement.index]);
    for (const e of h.eliminations ?? []) {
      expect(e.digit, `${h.technique} removed the solution digit`).not.toBe(solution[e.index]);
    }
    applyHint(s, h);
  }
}

describe('soundness on generated puzzles', () => {
  const cases: [Difficulty, number][] = [
    ['easy', 5],
    ['medium', 5],
    ['hard', 5],
    ['expert', 5],
  ];
  for (const [difficulty, n] of cases) {
    it(`never contradicts the solution (${difficulty})`, () => {
      for (let seed = 1; seed <= n; seed++) {
        const p = generatePuzzle(difficulty, seed * 7919);
        assertSoundSteps(p.givens.map((v) => v ?? 0), p.solution);
      }
    });
  }

  it('solves the classic puzzle with singles only', () => {
    const r = solveLogically(CLASSIC);
    expect(r.solved).toBe(true);
    expect(r.hardestLevel).toBe(1);
    expect(Array.from(r.values)).toEqual(CLASSIC_SOLUTION);
  });
});

const toCells = (values: number[], givens: number[] = values): CellState[] =>
  values.map((v, i) => ({ value: v ? (v as Digit) : null, given: givens[i] !== 0, notes: 0 }));

describe('getHint', () => {
  const solution = CLASSIC_SOLUTION as Digit[];

  it('points out a wrong digit before anything else', () => {
    const values = CLASSIC.slice();
    values[2] = 1; // correct digit is 4
    const r = getHint(toCells(values, CLASSIC), solution);
    expect(r).toMatchObject({ kind: 'mistake', index: 2, i18nParams: { cell: 'R1C3', digit: 1 } });
  });

  it('points out notes that exclude the correct digit', () => {
    const cells = toCells(CLASSIC);
    cells[2].notes = bit(1) | bit(2); // correct digit 4 missing
    expect(getHint(cells, solution)).toMatchObject({ kind: 'badNotes', index: 2 });
  });

  it('returns a placement step on a fresh puzzle', () => {
    const r = getHint(toCells(CLASSIC), solution);
    expect(r.kind).toBe('step');
    if (r.kind !== 'step') return;
    const { index, digit } = r.hint.placement!;
    expect(digit).toBe(solution[index]);
    expect(r.hint.i18nKey).toBe(`hints.${r.hint.technique}.explain`);
  });

  it('reports a solved board', () => {
    expect(getHint(toCells(CLASSIC_SOLUTION), solution)).toEqual({ kind: 'solved' });
  });

  it('skips eliminations already reflected in the notes', () => {
    // Play a medium puzzle with singles until the next step is an elimination.
    const p = generatePuzzle('medium', 2024);
    const values = p.givens.map((v) => v ?? 0);
    const state = candidatesFromValues(values);
    let elim: Hint | null = null;
    for (;;) {
      const h = findNextStep(state)!;
      if (!h.placement) {
        elim = h;
        break;
      }
      applyHint(state, h);
      values[h.placement.index] = h.placement.digit;
    }
    const givens = p.givens.map((v) => v ?? 0);
    const cells = toCells(values, givens);

    // Without notes, the elimination itself is the hint, with notes to fill in.
    const first = getHint(cells, p.solution);
    expect(first.kind).toBe('step');
    if (first.kind !== 'step') return;
    expect(first.hint.technique).toBe(elim.technique);
    expect(first.noteUpdates.length).toBeGreaterThan(0);
    for (const u of first.noteUpdates) {
      for (const e of elim.eliminations!) if (e.index === u.index) expect(u.notes & bit(e.digit)).toBe(0);
    }

    // Once the player's notes show the elimination, the hint moves on.
    applyHint(state, elim);
    for (let i = 0; i < 81; i++) if (cells[i].value === null) cells[i].notes = state.cands[i];
    const second = getHint(cells, p.solution);
    expect(second.kind).toBe('step');
    if (second.kind !== 'step') return;
    expect(second.hint).not.toEqual(first.hint);
  });
});
