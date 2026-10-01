import { useStore } from 'zustand';
import { gameStore, type GameStore } from './gameStore';
import { settingsStore, type SettingsStore } from './settingsStore';
import { statsStore, type StatsStore } from './statsStore';
import { uiStore, type UiStore } from './uiStore';

export const useGame = <T>(selector: (s: GameStore) => T): T => useStore(gameStore, selector);
export const useSettings = <T>(selector: (s: SettingsStore) => T): T => useStore(settingsStore, selector);
export const useStats = <T>(selector: (s: StatsStore) => T): T => useStore(statsStore, selector);
export const useUi = <T>(selector: (s: UiStore) => T): T => useStore(uiStore, selector);
