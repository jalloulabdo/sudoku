import { createStore } from 'zustand/vanilla';

/** Transient UI state that is never saved. */
export interface UiStore {
  generating: boolean;
  settingsOpen: boolean;
  newGameOpen: boolean;
}

export const uiStore = createStore<UiStore>()(() => ({
  generating: false,
  settingsOpen: false,
  newGameOpen: false,
}));
