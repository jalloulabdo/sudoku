import { STORAGE_KEYS, loadValue, saveValue } from '../../src/storage/storage';
import { startClock } from '../../src/store/clock';
import { gameStore } from '../../src/store/gameStore';
import { SAVE_DELAY_MS, initPersistence } from '../../src/store/persistence';
import { settingsStore } from '../../src/store/settingsStore';
import { statsStore } from '../../src/store/statsStore';
import { dailyStreaks } from '../../src/logic/daily';
import { MemoryStorage, classicPuzzle, resetStores } from './helpers';

let storage: MemoryStorage;
let cleanup: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  resetStores();
});

afterEach(() => {
  cleanup?.();
  cleanup = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const stored = (key: string) => JSON.parse(storage.getItem(key) ?? 'null');

describe('save / restore round-trip', () => {
  it('restores game, settings and stats exactly', () => {
    cleanup = initPersistence();
    const s = gameStore.getState();
    s.newGame(classicPuzzle());
    s.select(3);
    s.toggleNote(6);
    s.select(2);
    s.place(4);
    s.tick(4321);
    settingsStore.getState().update({ theme: 'dark', language: 'ar', mistakeLimit: null });
    vi.advanceTimersByTime(SAVE_DELAY_MS);

    const game = gameStore.getState().game;
    const stats = statsStore.getState().byDifficulty;
    cleanup();
    cleanup = null;

    resetStores();
    expect(gameStore.getState().game).toBeNull();
    cleanup = initPersistence();

    expect(gameStore.getState().game).toEqual(game);
    expect(settingsStore.getState()).toMatchObject({ theme: 'dark', language: 'ar', mistakeLimit: null });
    expect(statsStore.getState().byDifficulty).toEqual(stats);

    // The restored game is fully playable, including undo.
    gameStore.getState().undo();
    expect(gameStore.getState().game!.cells[2].value).toBeNull();
  });

  it('waits for the debounce delay before writing', () => {
    cleanup = initPersistence();
    gameStore.getState().newGame(classicPuzzle());
    expect(storage.getItem(STORAGE_KEYS.game)).toBeNull();
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    expect(stored(STORAGE_KEYS.game).schemaVersion).toBe(1);
  });

  it('keeps saving during a steady stream of timer ticks', () => {
    cleanup = initPersistence();
    gameStore.getState().newGame(classicPuzzle());
    for (let i = 0; i < 8; i++) {
      gameStore.getState().tick(250);
      vi.advanceTimersByTime(250);
    }
    expect(stored(STORAGE_KEYS.game).data.elapsedMs).toBeGreaterThanOrEqual(1500);
  });

  it('flushes immediately when the page is hidden', () => {
    const listeners: Record<string, () => void> = {};
    vi.stubGlobal('window', {
      addEventListener: (type: string, fn: () => void) => (listeners[type] = fn),
      removeEventListener: () => {},
    });
    vi.stubGlobal('document', {
      visibilityState: 'hidden',
      addEventListener: (type: string, fn: () => void) => (listeners[type] = fn),
      removeEventListener: () => {},
    });
    cleanup = initPersistence();
    gameStore.getState().newGame(classicPuzzle());
    listeners.visibilitychange();
    expect(storage.getItem(STORAGE_KEYS.game)).not.toBeNull();

    gameStore.getState().tick(1000);
    listeners.pagehide();
    expect(stored(STORAGE_KEYS.game).data.elapsedMs).toBe(1000);
  });
});

describe('storage robustness', () => {
  it('discards corrupt data', () => {
    storage.setItem(STORAGE_KEYS.game, '{not json');
    storage.setItem(STORAGE_KEYS.settings, JSON.stringify({ schemaVersion: 1, data: { theme: 'neon', showTimer: false } }));
    cleanup = initPersistence();
    expect(gameStore.getState().game).toBeNull();
    expect(settingsStore.getState()).toMatchObject({ theme: 'system', showTimer: false });
  });

  it('ignores data from a newer schema and runs migrations for older ones', () => {
    const spec = {
      version: 2,
      migrations: { 1: (d: unknown) => ({ ...(d as object), migrated: true }) },
      validate: (d: unknown) => d as Record<string, unknown>,
    };
    saveValue('k', 1, { a: 1 });
    expect(loadValue('k', spec)).toEqual({ a: 1, migrated: true });
    saveValue('k', 3, { a: 1 });
    expect(loadValue('k', spec)).toBeNull();
  });

  it('keeps working when writes fail or storage is missing', () => {
    storage.failWrites = true;
    expect(saveValue('k', 1, {})).toBe(false);
    cleanup = initPersistence();
    gameStore.getState().newGame(classicPuzzle());
    expect(() => vi.advanceTimersByTime(SAVE_DELAY_MS)).not.toThrow();

    vi.stubGlobal('localStorage', undefined);
    expect(saveValue('k', 1, {})).toBe(false);
    expect(loadValue('k', { version: 1, validate: (d) => d })).toBeNull();
  });
});

describe('clock', () => {
  it('reports real elapsed time and caps long gaps', () => {
    let now = 0;
    const deltas: number[] = [];
    const stop = startClock((d) => deltas.push(d), { now: () => now, intervalMs: 250 });
    now = 260;
    vi.advanceTimersByTime(250);
    now = 60_000; // device slept
    vi.advanceTimersByTime(250);
    stop();
    vi.advanceTimersByTime(1000);
    expect(deltas).toEqual([260, 1000]);
  });
});

describe('daily streaks', () => {
  it('counts the current and best runs', () => {
    const done = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-28', '2026-09-29', '2026-09-30'];
    expect(dailyStreaks(done, '2026-10-01')).toEqual({ current: 3, best: 3 }); // today not played yet
    expect(dailyStreaks([...done, '2026-10-01'], '2026-10-01')).toEqual({ current: 4, best: 4 });
    expect(dailyStreaks(done, '2026-10-02')).toEqual({ current: 0, best: 3 });
    expect(dailyStreaks(['2026-02-28', '2026-03-01'], '2026-03-01').current).toBe(2); // month boundary
  });
});
