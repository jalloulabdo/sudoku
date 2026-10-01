import type { CellIndex, Digit } from './types';

/** Bitmask with all nine candidates set. */
export const ALL_DIGITS = 0x1ff;

export const ROW_OF = new Uint8Array(81);
export const COL_OF = new Uint8Array(81);
export const BOX_OF = new Uint8Array(81);

for (let i = 0; i < 81; i++) {
  const r = Math.floor(i / 9);
  const c = i % 9;
  ROW_OF[i] = r;
  COL_OF[i] = c;
  BOX_OF[i] = Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

export type UnitType = 'row' | 'col' | 'box';

export interface Unit {
  type: UnitType;
  index: number; // 0..8
  cells: CellIndex[];
}

const range9 = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export const ROWS: Unit[] = range9.map((r) => ({
  type: 'row',
  index: r,
  cells: range9.map((c) => r * 9 + c),
}));

export const COLS: Unit[] = range9.map((c) => ({
  type: 'col',
  index: c,
  cells: range9.map((r) => r * 9 + c),
}));

export const BOXES: Unit[] = range9.map((b) => ({
  type: 'box',
  index: b,
  cells: range9.map((k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3)),
}));

/** Boxes first: that is the order humans usually scan in. */
export const UNITS: Unit[] = [...BOXES, ...ROWS, ...COLS];

export function isPeer(a: CellIndex, b: CellIndex): boolean {
  return a !== b && (ROW_OF[a] === ROW_OF[b] || COL_OF[a] === COL_OF[b] || BOX_OF[a] === BOX_OF[b]);
}

/** The 20 cells sharing a row, column or box with each cell. */
export const PEERS: CellIndex[][] = Array.from({ length: 81 }, (_, i) =>
  Array.from({ length: 81 }, (_, j) => j).filter((j) => isPeer(i, j)),
);

const POPCOUNT = new Uint8Array(512);
for (let m = 1; m < 512; m++) POPCOUNT[m] = POPCOUNT[m >> 1] + (m & 1);

export function popcount(mask: number): number {
  return POPCOUNT[mask & ALL_DIGITS];
}

export function bit(d: number): number {
  return 1 << (d - 1);
}

export function digitsOf(mask: number): Digit[] {
  const out: Digit[] = [];
  for (let d = 1; d <= 9; d++) if (mask & bit(d)) out.push(d as Digit);
  return out;
}

/** The digit of a single-bit mask. */
export function onlyDigit(mask: number): Digit {
  return (31 - Math.clz32(mask) + 1) as Digit;
}

/** Locale-neutral cell reference, e.g. R3C5. */
export function cellRef(i: CellIndex): string {
  return `R${ROW_OF[i] + 1}C${COL_OF[i] + 1}`;
}

export function combinations<T>(items: readonly T[], k: number): T[][] {
  const out: T[][] = [];
  const pick: T[] = [];
  const walk = (start: number) => {
    if (pick.length === k) {
      out.push(pick.slice());
      return;
    }
    for (let i = start; i <= items.length - (k - pick.length); i++) {
      pick.push(items[i]);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);
  return out;
}
