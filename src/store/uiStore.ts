import { createStore } from 'zustand/vanilla';

/** What happened to the score of a finished (or starting) game. */
export type ScoreState = { puzzleId: string } & (
  | { state: 'unranked'; reason: 'signedOut' | 'offline' | 'alreadyScored' | 'error' }
  | { state: 'submitting' | 'queued' }
  | { state: 'scored'; points: number; base: number; timeBonus: number; penalty: number; dailyRank: number | null }
  | { state: 'rejected'; code: string }
);

/** Transient UI state that is never saved. */
export interface UiStore {
  generating: boolean;
  settingsOpen: boolean;
  newGameOpen: boolean;
  score: ScoreState | null;
}

export const uiStore = createStore<UiStore>()(() => ({
  generating: false,
  settingsOpen: false,
  newGameOpen: false,
  score: null,
}));
