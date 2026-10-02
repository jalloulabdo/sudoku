export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type CellValue = Digit | null;
export type CellIndex = number; // 0..80, row-major: index = row * 9 + col

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'master';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'master'];

export interface Puzzle {
  id: string; // deterministic: `${difficulty}-${seed}` or `daily-YYYY-MM-DD`
  givens: CellValue[]; // length 81
  solution: Digit[]; // length 81
  difficulty: Difficulty;
  seed: number;
}

export interface CellState {
  value: CellValue;
  given: boolean;
  notes: number; // 9-bit mask, bit (d-1) set = candidate d
}

export type Move =
  | {
      type: 'place';
      index: CellIndex;
      prev: CellState;
      next: CellState;
      affected: { index: CellIndex; prevNotes: number }[];
    }
  | { type: 'note'; index: CellIndex; prev: CellState; next: CellState }
  | { type: 'erase'; index: CellIndex; prev: CellState; next: CellState }
  /** Several note changes undone in one step (applied elimination hints). */
  | { type: 'notes'; changes: { index: CellIndex; prevNotes: number; nextNotes: number }[] };

export interface GameState {
  puzzle: Puzzle;
  cells: CellState[]; // length 81
  selected: CellIndex | null;
  notesMode: boolean;
  history: Move[];
  future: Move[]; // redo stack
  mistakes: number;
  elapsedMs: number;
  status: 'playing' | 'paused' | 'won' | 'lost';
  hintsUsed: number;
  /** The one "second chance" after hitting the mistake limit has been used. */
  secondChanceUsed: boolean;
  /** Server ticket for a ranked game (signed in and online at the start), else null. */
  ticketId: string | null;
}

export type TechniqueId =
  | 'nakedSingle'
  | 'hiddenSingle'
  | 'pointing'
  | 'claiming'
  | 'nakedPair'
  | 'hiddenPair'
  | 'nakedTriple'
  | 'hiddenTriple'
  | 'xWing'
  | 'xyWing';

export interface Hint {
  technique: TechniqueId;
  focusCells: CellIndex[]; // cells to highlight as the reason
  targetCells: CellIndex[]; // cells affected
  placement?: { index: CellIndex; digit: Digit };
  eliminations?: { index: CellIndex; digit: Digit }[];
  i18nKey: string; // e.g. 'hints.hiddenSingle.explain'
  i18nParams: Record<string, string | number>;
}
