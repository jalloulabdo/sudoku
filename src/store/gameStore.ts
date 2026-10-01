import { createStore } from 'zustand/vanilla';
import { PEERS, bit } from '../logic/board';
import { candidatesFromValues, getHint, type HintResult } from '../logic/techniques';
import type { CellIndex, CellState, Digit, GameState, Move, Puzzle } from '../logic/types';
import { isObject } from '../storage/storage';
import { settingsStore } from './settingsStore';
import { statsStore } from './statsStore';

export const GAME_VERSION = 1;

export interface GameStore {
  game: GameState | null;
  /** A hint shown but not applied yet; the next hint() call applies it. */
  activeHint: HintResult | null;

  newGame(puzzle: Puzzle): void;
  restart(): void;
  restore(game: GameState): void;
  select(index: CellIndex | null): void;
  toggleNotesMode(): void;
  /** Places or notes `digit` in the selected cell, depending on notes mode. */
  input(digit: Digit): void;
  place(digit: Digit): void;
  toggleNote(digit: Digit): void;
  erase(): void;
  undo(): void;
  redo(): void;
  /** First call shows a hint, second call applies it. */
  hint(): void;
  dismissHint(): void;
  pause(): void;
  resume(): void;
  tick(deltaMs: number): void;
  /** After losing: take back the losing move and allow one more mistake. Once per game. */
  secondChance(): void;
}

// ---------------------------------------------------------------------------
// Pure board helpers

function cellsFromPuzzle(puzzle: Puzzle): CellState[] {
  return puzzle.givens.map((value) => ({ value, given: value !== null, notes: 0 }));
}

function freshGame(puzzle: Puzzle): GameState {
  return {
    puzzle,
    cells: cellsFromPuzzle(puzzle),
    selected: null,
    notesMode: false,
    history: [],
    future: [],
    mistakes: 0,
    elapsedMs: 0,
    status: 'playing',
    hintsUsed: 0,
    secondChanceUsed: false,
  };
}

/** Givens and correctly placed digits can't be changed. */
function isLocked(g: GameState, i: CellIndex): boolean {
  const c = g.cells[i];
  return c.given || c.value === g.puzzle.solution[i];
}

function applyMove(cells: readonly CellState[], move: Move): CellState[] {
  const out = cells.slice();
  switch (move.type) {
    case 'place':
      out[move.index] = move.next;
      for (const a of move.affected) out[a.index] = { ...out[a.index], notes: a.prevNotes & ~bit(move.next.value!) };
      break;
    case 'note':
    case 'erase':
      out[move.index] = move.next;
      break;
    case 'notes':
      for (const ch of move.changes) out[ch.index] = { ...out[ch.index], notes: ch.nextNotes };
      break;
  }
  return out;
}

function revertMove(cells: readonly CellState[], move: Move): CellState[] {
  const out = cells.slice();
  switch (move.type) {
    case 'place':
      out[move.index] = move.prev;
      for (const a of move.affected) out[a.index] = { ...out[a.index], notes: a.prevNotes };
      break;
    case 'note':
    case 'erase':
      out[move.index] = move.prev;
      break;
    case 'notes':
      for (const ch of move.changes) out[ch.index] = { ...out[ch.index], notes: ch.prevNotes };
      break;
  }
  return out;
}

function commit(g: GameState, move: Move): GameState {
  return { ...g, cells: applyMove(g.cells, move), history: [...g.history, move], future: [] };
}

const isSolved = (g: GameState) => g.cells.every((c, i) => c.value === g.puzzle.solution[i]);

/** Places a digit with auto note cleanup, mistake counting and win/loss detection. */
function placeDigit(g: GameState, i: CellIndex, digit: Digit): GameState {
  const cell = g.cells[i];
  const correct = digit === g.puzzle.solution[i];
  const { autoRemoveNotes, mistakeLimit } = settingsStore.getState();
  const mask = bit(digit);
  const affected =
    correct && autoRemoveNotes
      ? PEERS[i]
          .filter((p) => g.cells[p].value === null && (g.cells[p].notes & mask) !== 0)
          .map((p) => ({ index: p, prevNotes: g.cells[p].notes }))
      : [];
  let next = commit(g, {
    type: 'place',
    index: i,
    prev: cell,
    next: { value: digit, given: false, notes: 0 },
    affected,
  });
  if (!correct) {
    const mistakes = g.mistakes + 1;
    next = { ...next, mistakes };
    if (mistakeLimit !== null && mistakes >= mistakeLimit) next = { ...next, status: 'lost' };
  }
  return checkWin(next);
}

function checkWin(g: GameState): GameState {
  if (g.status !== 'playing' || !isSolved(g)) return g;
  const stats = statsStore.getState();
  stats.recordWin(g.puzzle.difficulty, g.elapsedMs);
  if (g.puzzle.id.startsWith('daily-')) stats.recordDailyComplete(g.puzzle.id.slice('daily-'.length));
  return { ...g, status: 'won', selected: null, notesMode: false };
}

/** The cell a hint is about, so the UI can select it. */
function hintCell(h: HintResult): CellIndex | null {
  switch (h.kind) {
    case 'step':
      return h.hint.placement?.index ?? h.hint.targetCells[0] ?? null;
    case 'mistake':
    case 'badNotes':
      return h.index;
    default:
      return null;
  }
}

function applyHintResult(g: GameState, h: HintResult): GameState {
  switch (h.kind) {
    case 'step': {
      if (h.hint.placement) return placeDigit(g, h.hint.placement.index, h.hint.placement.digit);
      const changes = h.noteUpdates
        .map((u) => ({ index: u.index, prevNotes: g.cells[u.index].notes, nextNotes: u.notes }))
        .filter((c) => c.prevNotes !== c.nextNotes);
      return changes.length ? commit(g, { type: 'notes', changes }) : g;
    }
    case 'mistake': {
      const prev = g.cells[h.index];
      return commit(g, { type: 'erase', index: h.index, prev, next: { value: null, given: false, notes: 0 } });
    }
    case 'badNotes': {
      const cands = candidatesFromValues(g.cells.map((c) => c.value ?? 0)).cands;
      const prevNotes = g.cells[h.index].notes;
      return commit(g, { type: 'notes', changes: [{ index: h.index, prevNotes, nextNotes: cands[h.index] }] });
    }
    case 'none': {
      // No known technique applies: reveal the selected cell, or the first unsolved one.
      const wrong = (i: number) => g.cells[i].value !== g.puzzle.solution[i];
      const i = g.selected !== null && wrong(g.selected) ? g.selected : g.cells.findIndex((_, k) => wrong(k));
      return i === -1 ? g : placeDigit(g, i, g.puzzle.solution[i]);
    }
    case 'solved':
      return g;
  }
}

// ---------------------------------------------------------------------------
// Store

export const gameStore = createStore<GameStore>()((set, get) => {
  /** Runs `fn` only while a game is being played; clears any shown hint when the board changes. */
  const play = (fn: (g: GameState) => GameState | null) => {
    const g = get().game;
    if (!g || g.status !== 'playing') return;
    const next = fn(g);
    if (next && next !== g) set({ game: next, activeHint: next.cells !== g.cells ? null : get().activeHint });
  };

  /** Like play(), for actions on the selected, editable cell. */
  const onSelected = (fn: (g: GameState, i: CellIndex) => GameState | null) =>
    play((g) => (g.selected === null || g.cells[g.selected].given ? null : fn(g, g.selected)));

  return {
    game: null,
    activeHint: null,

    newGame: (puzzle) => {
      statsStore.getState().recordStart(puzzle.difficulty);
      set({ game: freshGame(puzzle), activeHint: null });
    },

    restart: () => {
      const g = get().game;
      if (g) set({ game: freshGame(g.puzzle), activeHint: null });
    },

    restore: (game) => set({ game, activeHint: null }),

    select: (index) => play((g) => ({ ...g, selected: index })),

    toggleNotesMode: () => play((g) => ({ ...g, notesMode: !g.notesMode })),

    input: (digit) => (get().game?.notesMode ? get().toggleNote(digit) : get().place(digit)),

    place: (digit) =>
      onSelected((g, i) => (isLocked(g, i) || g.cells[i].value === digit ? null : placeDigit(g, i, digit))),

    toggleNote: (digit) =>
      onSelected((g, i) => {
        const prev = g.cells[i];
        if (prev.value !== null) return null;
        return commit(g, { type: 'note', index: i, prev, next: { ...prev, notes: prev.notes ^ bit(digit) } });
      }),

    erase: () =>
      onSelected((g, i) => {
        const prev = g.cells[i];
        if (isLocked(g, i) || (prev.value === null && prev.notes === 0)) return null;
        return commit(g, { type: 'erase', index: i, prev, next: { value: null, given: false, notes: 0 } });
      }),

    undo: () =>
      play((g) => {
        const move = g.history.at(-1);
        if (!move) return null;
        return { ...g, cells: revertMove(g.cells, move), history: g.history.slice(0, -1), future: [...g.future, move] };
      }),

    redo: () =>
      play((g) => {
        const move = g.future.at(-1);
        if (!move) return null;
        return checkWin({
          ...g,
          cells: applyMove(g.cells, move),
          history: [...g.history, move],
          future: g.future.slice(0, -1),
        });
      }),

    hint: () => {
      const g = get().game;
      if (!g || g.status !== 'playing') return;
      const shown = get().activeHint;
      if (shown) {
        const next = applyHintResult(g, shown);
        set({ game: { ...next, hintsUsed: next.hintsUsed + 1 }, activeHint: null });
        return;
      }
      const result = getHint(g.cells, g.puzzle.solution);
      if (result.kind === 'solved') return;
      const cell = hintCell(result);
      set({ activeHint: result, game: cell === null ? g : { ...g, selected: cell } });
    },

    dismissHint: () => set({ activeHint: null }),

    pause: () => play((g) => ({ ...g, status: 'paused' })),

    resume: () => {
      const g = get().game;
      if (g?.status === 'paused') set({ game: { ...g, status: 'playing' } });
    },

    tick: (deltaMs) => play((g) => (deltaMs > 0 ? { ...g, elapsedMs: g.elapsedMs + deltaMs } : null)),

    secondChance: () => {
      const g = get().game;
      const limit = settingsStore.getState().mistakeLimit;
      if (!g || g.status !== 'lost' || g.secondChanceUsed || limit === null) return;
      const move = g.history.at(-1);
      const cells = move ? revertMove(g.cells, move) : g.cells;
      set({
        game: {
          ...g,
          cells,
          history: g.history.slice(0, -1),
          future: [],
          mistakes: limit - 1,
          status: 'playing',
          secondChanceUsed: true,
        },
        activeHint: null,
      });
    },
  };
});

// ---------------------------------------------------------------------------
// Persistence validation

const STATUSES = new Set(['playing', 'paused', 'won', 'lost']);
const isCellArray = (v: unknown): v is CellState[] =>
  Array.isArray(v) &&
  v.length === 81 &&
  v.every((c) => isObject(c) && typeof c.given === 'boolean' && typeof c.notes === 'number');

export function validateGame(data: unknown): GameState | null {
  if (data === null || !isObject(data) || !isObject(data.puzzle)) return null;
  const p = data.puzzle;
  if (!Array.isArray(p.givens) || p.givens.length !== 81 || !Array.isArray(p.solution) || p.solution.length !== 81) {
    return null;
  }
  if (typeof p.id !== 'string' || typeof p.difficulty !== 'string') return null;
  if (!isCellArray(data.cells) || !Array.isArray(data.history) || !Array.isArray(data.future)) return null;
  if (typeof data.status !== 'string' || !STATUSES.has(data.status)) return null;
  if (typeof data.mistakes !== 'number' || typeof data.elapsedMs !== 'number') return null;
  return {
    ...(data as unknown as GameState),
    selected: typeof data.selected === 'number' ? data.selected : null,
    hintsUsed: typeof data.hintsUsed === 'number' ? data.hintsUsed : 0,
    secondChanceUsed: data.secondChanceUsed === true,
  };
}
