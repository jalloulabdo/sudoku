import { ALL_DIGITS, bit } from '../../src/logic/board';
import type { CandidateState } from '../../src/logic/techniques';

export const parse = (s: string): number[] => [...s].map((ch) => (ch === '.' ? 0 : Number(ch)));

/** Classic example puzzle (Wikipedia) and its solution. */
export const CLASSIC = parse('530070000600195000098000060800060003400803001700020006060000280000419005000080079');
export const CLASSIC_SOLUTION = parse(
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
);

/** A 17-clue puzzle (minimum possible givens) with a unique solution. */
export const SEVENTEEN = parse('000000010400000000020000000000050407008000300001090000300400200050100000000806000');

/** An empty board where every cell still has all nine candidates. */
export function openState(): CandidateState {
  return { values: new Uint8Array(81), cands: new Uint16Array(81).fill(ALL_DIGITS) };
}

export function removeCandidates(s: CandidateState, cells: number[], digits: number[]): void {
  let m = 0;
  for (const d of digits) m |= bit(d);
  for (const c of cells) s.cands[c] &= ~m;
}

export function setCandidates(s: CandidateState, cell: number, digits: number[]): void {
  s.cands[cell] = digits.reduce((m, d) => m | bit(d), 0);
}

export const rowCells = (r: number) => Array.from({ length: 9 }, (_, c) => r * 9 + c);
export const colCells = (c: number) => Array.from({ length: 9 }, (_, r) => r * 9 + c);
