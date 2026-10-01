import {
  ALL_DIGITS,
  BOXES,
  BOX_OF,
  COLS,
  COL_OF,
  PEERS,
  ROWS,
  ROW_OF,
  UNITS,
  bit,
  cellRef,
  combinations,
  digitsOf,
  isPeer,
  onlyDigit,
  popcount,
  type Unit,
} from './board';
import type { GridInput } from './solver';
import type { CellIndex, CellState, Digit, Hint, TechniqueId } from './types';

/** Placed values (0 = empty) plus the candidate mask of every empty cell. */
export interface CandidateState {
  values: Uint8Array;
  cands: Uint16Array;
}

/** The order in which techniques are tried: easiest first. */
export const TECHNIQUE_ORDER: readonly TechniqueId[] = [
  'nakedSingle',
  'hiddenSingle',
  'pointing',
  'claiming',
  'nakedPair',
  'hiddenPair',
  'nakedTriple',
  'hiddenTriple',
  'xWing',
  'xyWing',
];

/** 1 = singles, 2 = intersections, 3 = subsets, 4 = fish & wings. */
export const TECHNIQUE_LEVEL: Record<TechniqueId, number> = {
  nakedSingle: 1,
  hiddenSingle: 1,
  pointing: 2,
  claiming: 2,
  nakedPair: 3,
  hiddenPair: 3,
  nakedTriple: 3,
  hiddenTriple: 3,
  xWing: 4,
  xyWing: 4,
};

export const MAX_LEVEL = 4;

export function candidatesFromValues(grid: GridInput): CandidateState {
  const values = new Uint8Array(81);
  for (let i = 0; i < 81; i++) values[i] = grid[i] ?? 0;
  const cands = new Uint16Array(81);
  for (let i = 0; i < 81; i++) {
    if (values[i] !== 0) continue;
    let used = 0;
    for (const p of PEERS[i]) if (values[p] !== 0) used |= bit(values[p]);
    cands[i] = ALL_DIGITS & ~used;
  }
  return { values, cands };
}

export function applyHint(state: CandidateState, hint: Hint): void {
  if (hint.placement) {
    const { index, digit } = hint.placement;
    const m = bit(digit);
    state.values[index] = digit;
    state.cands[index] = 0;
    for (const p of PEERS[index]) state.cands[p] &= ~m;
  }
  for (const e of hint.eliminations ?? []) state.cands[e.index] &= ~bit(e.digit);
}

// ---------------------------------------------------------------------------
// Helpers

type HintParts = Omit<Hint, 'technique' | 'i18nKey'>;

function makeHint(technique: TechniqueId, parts: HintParts): Hint {
  return { technique, i18nKey: `hints.${technique}.explain`, ...parts };
}

/** Empty cells among `cells` that still have candidate mask `m`. */
function positions(s: CandidateState, cells: readonly CellIndex[], m: number): CellIndex[] {
  return cells.filter((c) => s.values[c] === 0 && (s.cands[c] & m) !== 0);
}

const cellList = (cells: readonly CellIndex[]) => cells.map(cellRef).join(', ');
const digitList = (mask: number) => digitsOf(mask).join(', ');
// `context` selects the i18next context variant, e.g. `explain_row` / `explain_box`.
const unitParams = (u: Unit) => ({ context: u.type, unit: u.index + 1 });

function uniqueCells(elims: { index: CellIndex }[]): CellIndex[] {
  return [...new Set(elims.map((e) => e.index))];
}

// ---------------------------------------------------------------------------
// Level 1: singles

function nakedSingle(s: CandidateState): Hint | null {
  for (let i = 0; i < 81; i++) {
    if (s.values[i] !== 0 || popcount(s.cands[i]) !== 1) continue;
    const digit = onlyDigit(s.cands[i]);
    return makeHint('nakedSingle', {
      focusCells: PEERS[i].filter((p) => s.values[p] !== 0),
      targetCells: [i],
      placement: { index: i, digit },
      i18nParams: { cell: cellRef(i), digit },
    });
  }
  return null;
}

function hiddenSingle(s: CandidateState): Hint | null {
  for (const u of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const pos = positions(s, u.cells, bit(d));
      if (pos.length !== 1) continue;
      const digit = d as Digit;
      return makeHint('hiddenSingle', {
        focusCells: u.cells,
        targetCells: pos,
        placement: { index: pos[0], digit },
        i18nParams: { cell: cellRef(pos[0]), digit, ...unitParams(u) },
      });
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Level 2: intersections

/** A digit confined to one line inside a box can be removed from the rest of that line. */
function pointing(s: CandidateState): Hint | null {
  for (const box of BOXES) {
    for (let d = 1; d <= 9; d++) {
      const m = bit(d);
      const pos = positions(s, box.cells, m);
      if (pos.length < 2) continue;
      for (const line of [ROWS[ROW_OF[pos[0]]], COLS[COL_OF[pos[0]]]]) {
        if (!pos.every((p) => line.cells.includes(p))) continue;
        const targets = positions(s, line.cells, m).filter((c) => BOX_OF[c] !== box.index);
        if (targets.length === 0) continue;
        return makeHint('pointing', {
          focusCells: pos,
          targetCells: targets,
          eliminations: targets.map((index) => ({ index, digit: d as Digit })),
          i18nParams: { digit: d, box: box.index + 1, size: pos.length, ...unitParams(line) },
        });
      }
    }
  }
  return null;
}

/** A digit confined to one box inside a line can be removed from the rest of that box. */
function claiming(s: CandidateState): Hint | null {
  for (const line of [...ROWS, ...COLS]) {
    for (let d = 1; d <= 9; d++) {
      const m = bit(d);
      const pos = positions(s, line.cells, m);
      if (pos.length < 2) continue;
      const b = BOX_OF[pos[0]];
      if (!pos.every((p) => BOX_OF[p] === b)) continue;
      const targets = positions(s, BOXES[b].cells, m).filter((c) => !line.cells.includes(c));
      if (targets.length === 0) continue;
      return makeHint('claiming', {
        focusCells: pos,
        targetCells: targets,
        eliminations: targets.map((index) => ({ index, digit: d as Digit })),
        i18nParams: { digit: d, box: b + 1, ...unitParams(line) },
      });
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Level 3: subsets

/** k cells in a unit whose candidates together are exactly k digits. */
function nakedSubset(s: CandidateState, k: number, technique: TechniqueId): Hint | null {
  for (const u of UNITS) {
    const empties = u.cells.filter((c) => s.values[c] === 0);
    const small = empties.filter((c) => {
      const n = popcount(s.cands[c]);
      return n >= 2 && n <= k;
    });
    if (small.length < k) continue;
    for (const combo of combinations(small, k)) {
      let union = 0;
      for (const c of combo) union |= s.cands[c];
      if (popcount(union) !== k) continue;
      const eliminations: { index: CellIndex; digit: Digit }[] = [];
      for (const c of empties) {
        if (combo.includes(c)) continue;
        for (const digit of digitsOf(s.cands[c] & union)) eliminations.push({ index: c, digit });
      }
      if (eliminations.length === 0) continue;
      return makeHint(technique, {
        focusCells: combo,
        targetCells: uniqueCells(eliminations),
        eliminations,
        i18nParams: { cells: cellList(combo), digits: digitList(union), ...unitParams(u) },
      });
    }
  }
  return null;
}

/** k digits in a unit that can only go in the same k cells: those cells lose every other candidate. */
function hiddenSubset(s: CandidateState, k: number, technique: TechniqueId): Hint | null {
  for (const u of UNITS) {
    const empties = u.cells.filter((c) => s.values[c] === 0);
    if (empties.length <= k) continue;
    const digitPos = new Map<number, CellIndex[]>();
    for (let d = 1; d <= 9; d++) {
      const pos = positions(s, empties, bit(d));
      if (pos.length >= 2 && pos.length <= k) digitPos.set(d, pos);
    }
    if (digitPos.size < k) continue;
    for (const combo of combinations([...digitPos.keys()], k)) {
      const cells = [...new Set(combo.flatMap((d) => digitPos.get(d)!))].sort((a, b) => a - b);
      if (cells.length !== k) continue;
      let digitMask = 0;
      for (const d of combo) digitMask |= bit(d);
      const eliminations: { index: CellIndex; digit: Digit }[] = [];
      for (const c of cells) {
        for (const digit of digitsOf(s.cands[c] & ~digitMask)) eliminations.push({ index: c, digit });
      }
      if (eliminations.length === 0) continue;
      return makeHint(technique, {
        focusCells: cells,
        targetCells: cells,
        eliminations,
        i18nParams: { cells: cellList(cells), digits: digitList(digitMask), ...unitParams(u) },
      });
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Level 4: fish & wings

const XWING_ORIENTATIONS = [
  { base: ROWS, crossOf: COL_OF, cross: COLS },
  { base: COLS, crossOf: ROW_OF, cross: ROWS },
] as const;

/** A digit appearing exactly twice in two parallel lines, in the same two cross lines. */
function xWing(s: CandidateState): Hint | null {
  for (let d = 1; d <= 9; d++) {
    const m = bit(d);
    for (const { base, crossOf, cross } of XWING_ORIENTATIONS) {
      const lines = base
        .map((line) => ({ line, pos: positions(s, line.cells, m) }))
        .filter((x) => x.pos.length === 2);
      for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
          const a = lines[i];
          const b = lines[j];
          const crossA = [crossOf[a.pos[0]], crossOf[a.pos[1]]];
          if (crossA[0] !== crossOf[b.pos[0]] || crossA[1] !== crossOf[b.pos[1]]) continue;
          const corners = [...a.pos, ...b.pos];
          const targets = crossA.flatMap((ci) =>
            positions(s, cross[ci].cells, m).filter((c) => !corners.includes(c)),
          );
          if (targets.length === 0) continue;
          return makeHint('xWing', {
            focusCells: corners,
            targetCells: targets,
            eliminations: targets.map((index) => ({ index, digit: d as Digit })),
            i18nParams: {
              digit: d,
              context: a.line.type,
              lines: `${a.line.index + 1}, ${b.line.index + 1}`,
              crossLines: `${crossA[0] + 1}, ${crossA[1] + 1}`,
            },
          });
        }
      }
    }
  }
  return null;
}

/** Pivot {x,y} sees wings {x,z} and {y,z}: any cell seeing both wings cannot be z. */
function xyWing(s: CandidateState): Hint | null {
  for (let p = 0; p < 81; p++) {
    if (s.values[p] !== 0 || popcount(s.cands[p]) !== 2) continue;
    const pm = s.cands[p];
    const wings = PEERS[p].filter(
      (q) => s.values[q] === 0 && popcount(s.cands[q]) === 2 && popcount(s.cands[q] & pm) === 1,
    );
    for (let i = 0; i < wings.length; i++) {
      for (let j = i + 1; j < wings.length; j++) {
        const a = wings[i];
        const b = wings[j];
        if ((s.cands[a] & pm) === (s.cands[b] & pm)) continue;
        const z = s.cands[a] & ~pm;
        if (z !== (s.cands[b] & ~pm)) continue;
        const targets = positions(s, PEERS[a], z).filter((c) => c !== p && isPeer(c, b));
        if (targets.length === 0) continue;
        const digit = onlyDigit(z);
        return makeHint('xyWing', {
          focusCells: [p, a, b],
          targetCells: targets,
          eliminations: targets.map((index) => ({ index, digit })),
          i18nParams: { pivot: cellRef(p), wings: cellList([a, b]), digit },
        });
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API

const FINDERS: Record<TechniqueId, (s: CandidateState) => Hint | null> = {
  nakedSingle,
  hiddenSingle,
  pointing,
  claiming,
  nakedPair: (s) => nakedSubset(s, 2, 'nakedPair'),
  hiddenPair: (s) => hiddenSubset(s, 2, 'hiddenPair'),
  nakedTriple: (s) => nakedSubset(s, 3, 'nakedTriple'),
  hiddenTriple: (s) => hiddenSubset(s, 3, 'hiddenTriple'),
  xWing,
  xyWing,
};

/** The easiest available logical step, or null if none of the known techniques applies. */
export function findNextStep(state: CandidateState, maxLevel = MAX_LEVEL): Hint | null {
  for (const id of TECHNIQUE_ORDER) {
    if (TECHNIQUE_LEVEL[id] > maxLevel) break;
    const hint = FINDERS[id](state);
    if (hint) return hint;
  }
  return null;
}

export interface LogicalSolveResult {
  solved: boolean;
  values: Uint8Array;
  /** 0 when the grid was already complete. */
  hardestLevel: number;
  hardest: TechniqueId | null;
  steps: number;
  usage: Partial<Record<TechniqueId, number>>;
}

/** Solves like a human, always using the easiest technique available. */
export function solveLogically(grid: GridInput, maxLevel = MAX_LEVEL): LogicalSolveResult {
  const state = candidatesFromValues(grid);
  const usage: Partial<Record<TechniqueId, number>> = {};
  let hardest: TechniqueId | null = null;
  let steps = 0;
  for (;;) {
    const hint = findNextStep(state, maxLevel);
    if (!hint) break;
    applyHint(state, hint);
    steps++;
    usage[hint.technique] = (usage[hint.technique] ?? 0) + 1;
    if (!hardest || TECHNIQUE_LEVEL[hint.technique] > TECHNIQUE_LEVEL[hardest]) hardest = hint.technique;
  }
  return {
    solved: state.values.every((v) => v !== 0),
    values: state.values,
    hardestLevel: hardest ? TECHNIQUE_LEVEL[hardest] : 0,
    hardest,
    steps,
    usage,
  };
}

export type HintResult =
  | {
      kind: 'step';
      hint: Hint;
      /** Notes to set when applying an elimination hint (cells without notes get the full candidate list). */
      noteUpdates: { index: CellIndex; notes: number }[];
    }
  | { kind: 'mistake' | 'badNotes'; index: CellIndex; i18nKey: string; i18nParams: Record<string, string | number> }
  | { kind: 'none'; i18nKey: string }
  | { kind: 'solved' };

/**
 * The in-game hint. Works from the true candidates, not the player's notes, but skips
 * eliminations the player's notes already show so hints keep moving forward.
 */
export function getHint(cells: readonly CellState[], solution: readonly Digit[]): HintResult {
  for (let i = 0; i < 81; i++) {
    const v = cells[i].value;
    if (v !== null && v !== solution[i]) {
      return { kind: 'mistake', index: i, i18nKey: 'hints.mistake.explain', i18nParams: { cell: cellRef(i), digit: v } };
    }
  }
  for (let i = 0; i < 81; i++) {
    const c = cells[i];
    if (c.value === null && c.notes !== 0 && (c.notes & bit(solution[i])) === 0) {
      return { kind: 'badNotes', index: i, i18nKey: 'hints.badNotes.explain', i18nParams: { cell: cellRef(i) } };
    }
  }
  if (cells.every((c) => c.value !== null)) return { kind: 'solved' };

  const state = candidatesFromValues(cells.map((c) => c.value ?? 0));
  for (;;) {
    const hint = findNextStep(state);
    if (!hint) return { kind: 'none', i18nKey: 'hints.none.explain' };
    if (hint.placement) return { kind: 'step', hint, noteUpdates: [] };

    const eliminations = hint.eliminations ?? [];
    const alreadyNoted = eliminations.every((e) => {
      const notes = cells[e.index].notes;
      return notes !== 0 && (notes & bit(e.digit)) === 0;
    });
    if (!alreadyNoted) {
      const noteUpdates = hint.targetCells.map((index) => {
        let removed = 0;
        for (const e of eliminations) if (e.index === index) removed |= bit(e.digit);
        const base = cells[index].notes !== 0 ? cells[index].notes : state.cands[index];
        return { index, notes: base & ~removed };
      });
      return { kind: 'step', hint, noteUpdates };
    }
    applyHint(state, hint);
  }
}
