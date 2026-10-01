import type { StoreApi } from 'zustand/vanilla';
import { STORAGE_KEYS, loadValue, saveValue } from '../storage/storage';
import { GAME_VERSION, gameStore, validateGame } from './gameStore';
import { SETTINGS_VERSION, selectSettings, settingsStore, validateSettings } from './settingsStore';
import { STATS_VERSION, selectStats, statsStore, validateStats } from './statsStore';

export const SAVE_DELAY_MS = 300;

export interface PersistHandle {
  /** Writes any pending change now. */
  flush(): void;
  dispose(): void;
}

/**
 * Saves `select(state)` at most once per `delayMs` after a change. The delay is not reset by
 * further changes, so a steady stream of updates (the timer) still gets saved.
 */
export function persistStore<S, D>(
  store: StoreApi<S>,
  opts: { key: string; version: number; select: (s: S) => D; delayMs?: number },
): PersistHandle {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const write = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    saveValue(opts.key, opts.version, opts.select(store.getState()));
  };
  const unsubscribe = store.subscribe((state, prev) => {
    if (opts.select(state) === opts.select(prev) || timer !== null) return;
    timer = setTimeout(write, opts.delayMs ?? SAVE_DELAY_MS);
  });
  return {
    flush: () => {
      if (timer !== null) write();
    },
    dispose: () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      unsubscribe();
    },
  };
}

/** Loads saved settings, stats and the current game, then keeps them saved. Returns a cleanup function. */
export function initPersistence(): () => void {
  const settings = loadValue(STORAGE_KEYS.settings, { version: SETTINGS_VERSION, validate: validateSettings });
  if (settings) settingsStore.setState(settings);
  const stats = loadValue(STORAGE_KEYS.stats, { version: STATS_VERSION, validate: validateStats });
  if (stats) statsStore.setState(stats);
  const game = loadValue(STORAGE_KEYS.game, { version: GAME_VERSION, validate: validateGame });
  if (game) gameStore.getState().restore(game);

  const handles = [
    persistStore(settingsStore, { key: STORAGE_KEYS.settings, version: SETTINGS_VERSION, select: selectSettings }),
    persistStore(statsStore, { key: STORAGE_KEYS.stats, version: STATS_VERSION, select: selectStats }),
    persistStore(gameStore, { key: STORAGE_KEYS.game, version: GAME_VERSION, select: (s) => s.game }),
  ];
  const flushAll = () => handles.forEach((h) => h.flush());
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flushAll();
  };

  if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushAll);
  }
  return () => {
    flushAll();
    handles.forEach((h) => h.dispose());
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushAll);
    }
  };
}
