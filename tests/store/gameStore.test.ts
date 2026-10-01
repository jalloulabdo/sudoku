import { bit } from '../../src/logic/board';
import { gameStore } from '../../src/store/gameStore';
import { settingsStore } from '../../src/store/settingsStore';
import { statsStore } from '../../src/store/statsStore';
import { EMPTY_CELLS, classicPuzzle, resetStores, solutionAt, wrongAt } from './helpers';

const s = () => gameStore.getState();
const g = () => gameStore.getState().game!;

// In the classic puzzle R1C3 (index 2) is empty with solution 4, and R1C4 (index 3) is empty too.
const CELL = 2;
const PEER = 3;

beforeEach(() => {
  resetStores();
  s().newGame(classicPuzzle());
});

describe('new game', () => {
  it('sets up the board and counts a started game', () => {
    expect(g().cells[0]).toEqual({ value: 5, given: true, notes: 0 });
    expect(g().cells[CELL]).toEqual({ value: null, given: false, notes: 0 });
    expect(g().status).toBe('playing');
    expect(statsStore.getState().byDifficulty.easy.started).toBe(1);
  });
});

describe('placing, undo and redo', () => {
  it('places a digit, removes it from peer notes, and undo/redo restore everything', () => {
    s().select(PEER);
    s().toggleNote(4);
    s().toggleNote(7);
    expect(g().cells[PEER].notes).toBe(bit(4) | bit(7));

    s().select(CELL);
    s().place(4);
    expect(g().cells[CELL].value).toBe(4);
    expect(g().cells[PEER].notes).toBe(bit(7)); // 4 auto-removed

    s().undo();
    expect(g().cells[CELL].value).toBeNull();
    expect(g().cells[PEER].notes).toBe(bit(4) | bit(7)); // restored

    s().redo();
    expect(g().cells[CELL].value).toBe(4);
    expect(g().cells[PEER].notes).toBe(bit(7));

    s().undo();
    s().undo(); // the 7 note
    expect(g().cells[PEER].notes).toBe(bit(4));
  });

  it('keeps peer notes when auto-remove is off', () => {
    settingsStore.getState().update({ autoRemoveNotes: false });
    s().select(PEER);
    s().toggleNote(4);
    s().select(CELL);
    s().place(4);
    expect(g().cells[PEER].notes).toBe(bit(4));
  });

  it('a new move clears the redo stack', () => {
    s().select(CELL);
    s().place(4);
    s().undo();
    s().select(PEER);
    s().toggleNote(1);
    s().redo();
    expect(g().cells[CELL].value).toBeNull();
  });

  it('ignores givens and correctly placed digits, but lets wrong digits be overwritten', () => {
    s().select(0);
    s().place(1);
    s().erase();
    expect(g().cells[0].value).toBe(5);

    s().select(CELL);
    s().place(wrongAt(CELL));
    s().place(solutionAt(CELL));
    expect(g().cells[CELL].value).toBe(solutionAt(CELL));
    s().erase();
    s().place(wrongAt(CELL));
    expect(g().cells[CELL].value).toBe(solutionAt(CELL)); // locked once correct
  });

  it('input() follows notes mode', () => {
    s().select(CELL);
    s().toggleNotesMode();
    s().input(3);
    expect(g().cells[CELL]).toMatchObject({ value: null, notes: bit(3) });
    s().toggleNotesMode();
    s().input(4);
    expect(g().cells[CELL]).toMatchObject({ value: 4, notes: 0 });
  });

  it('erase clears notes and is undoable', () => {
    s().select(CELL);
    s().toggleNote(1);
    s().toggleNote(2);
    s().erase();
    expect(g().cells[CELL].notes).toBe(0);
    s().undo();
    expect(g().cells[CELL].notes).toBe(bit(1) | bit(2));
  });
});

describe('mistakes', () => {
  const makeMistake = (i: number) => {
    s().select(i);
    s().place(wrongAt(i));
  };

  it('counts wrong digits and loses at the limit', () => {
    makeMistake(EMPTY_CELLS[0]);
    makeMistake(EMPTY_CELLS[1]);
    expect(g().mistakes).toBe(2);
    expect(g().status).toBe('playing');
    makeMistake(EMPTY_CELLS[2]);
    expect(g().status).toBe('lost');

    // No more input once lost.
    s().select(EMPTY_CELLS[3]);
    s().place(solutionAt(EMPTY_CELLS[3]));
    expect(g().cells[EMPTY_CELLS[3]].value).toBeNull();
  });

  it('undo does not refund mistakes', () => {
    makeMistake(CELL);
    s().undo();
    expect(g().mistakes).toBe(1);
  });

  it('offers one second chance that takes back the losing move', () => {
    makeMistake(EMPTY_CELLS[0]);
    makeMistake(EMPTY_CELLS[1]);
    makeMistake(EMPTY_CELLS[2]);
    s().secondChance();
    expect(g()).toMatchObject({ status: 'playing', mistakes: 2, secondChanceUsed: true });
    expect(g().cells[EMPTY_CELLS[2]].value).toBeNull();

    makeMistake(EMPTY_CELLS[3]);
    expect(g().status).toBe('lost');
    s().secondChance();
    expect(g().status).toBe('lost');
  });

  it('never loses with the limit turned off', () => {
    settingsStore.getState().update({ mistakeLimit: null });
    for (const i of EMPTY_CELLS.slice(0, 10)) makeMistake(i);
    expect(g().mistakes).toBe(10);
    expect(g().status).toBe('playing');
  });
});

describe('winning', () => {
  const solveAll = () => {
    for (const i of EMPTY_CELLS) {
      s().select(i);
      s().place(solutionAt(i));
    }
  };

  it('detects a win and records stats', () => {
    s().tick(65_000);
    solveAll();
    expect(g().status).toBe('won');
    const stats = statsStore.getState().byDifficulty.easy;
    expect(stats).toMatchObject({ started: 1, won: 1, bestMs: 65_000, totalWonMs: 65_000 });
    expect(statsStore.getState().dailyCompleted).toEqual([]);
  });

  it('records daily completion', () => {
    s().newGame(classicPuzzle('daily-2026-10-01'));
    solveAll();
    expect(statsStore.getState().dailyCompleted).toEqual(['2026-10-01']);
  });

  it('detects a win reached by redo', () => {
    solveAll();
    gameStore.setState({ game: { ...g(), status: 'playing' } });
    s().undo();
    expect(g().status).toBe('playing');
    s().redo();
    expect(g().status).toBe('won');
  });
});

describe('hints', () => {
  it('shows first, then applies on the second press', () => {
    const before = g().cells;
    s().hint();
    const shown = s().activeHint!;
    expect(shown.kind).toBe('step');
    expect(g().cells).toBe(before); // nothing applied yet
    if (shown.kind !== 'step') return;
    const { index, digit } = shown.hint.placement!;
    expect(g().selected).toBe(index);

    s().hint();
    expect(g().cells[index].value).toBe(digit);
    expect(g().hintsUsed).toBe(1);
    expect(s().activeHint).toBeNull();
    expect(g().mistakes).toBe(0);
  });

  it('points to a wrong digit and erases it when applied', () => {
    s().select(CELL);
    s().place(wrongAt(CELL));
    s().hint();
    expect(s().activeHint).toMatchObject({ kind: 'mistake', index: CELL });
    s().hint();
    expect(g().cells[CELL].value).toBeNull();
  });

  it('a board change discards the shown hint', () => {
    s().hint();
    s().select(CELL);
    expect(s().activeHint).not.toBeNull(); // selecting is not a board change
    s().toggleNote(1);
    expect(s().activeHint).toBeNull();
  });
});

describe('timer and pause', () => {
  it('accumulates time only while playing, and pause blocks input', () => {
    s().tick(1000);
    s().pause();
    s().tick(5000);
    s().select(CELL);
    s().place(4);
    expect(g().elapsedMs).toBe(1000);
    expect(g().cells[CELL].value).toBeNull();
    s().resume();
    s().tick(500);
    expect(g().elapsedMs).toBe(1500);
  });

  it('restart resets the board but keeps the puzzle', () => {
    s().select(CELL);
    s().place(4);
    s().tick(1000);
    s().restart();
    expect(g().cells[CELL].value).toBeNull();
    expect(g()).toMatchObject({ elapsedMs: 0, mistakes: 0, history: [] });
    expect(g().puzzle.id).toBe('easy-1');
  });
});
