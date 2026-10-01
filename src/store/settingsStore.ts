import { createStore } from 'zustand/vanilla';
import { isLocale, type Locale } from '../i18n/locales';
import { isObject } from '../storage/storage';

export type Theme = 'light' | 'dark' | 'system';

export interface Settings {
  /** null = not chosen yet (follow the URL / browser language). */
  language: Locale | null;
  theme: Theme;
  /** null = unlimited mistakes. */
  mistakeLimit: 3 | null;
  highlightConflicts: boolean;
  highlightSameDigit: boolean;
  autoRemoveNotes: boolean;
  showTimer: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  language: null,
  theme: 'system',
  mistakeLimit: 3,
  highlightConflicts: true,
  highlightSameDigit: true,
  autoRemoveNotes: true,
  showTimer: true,
};

export const SETTINGS_VERSION = 1;

export interface SettingsStore extends Settings {
  update(patch: Partial<Settings>): void;
  reset(): void;
}

export const settingsStore = createStore<SettingsStore>()((set) => ({
  ...DEFAULT_SETTINGS,
  update: (patch) => set(patch),
  reset: () => set(DEFAULT_SETTINGS),
}));

export function selectSettings(s: SettingsStore): Settings {
  const { update: _u, reset: _r, ...settings } = s;
  return settings;
}

/** Keeps every valid saved field and falls back to the default for the rest. */
export function validateSettings(data: unknown): Settings | null {
  if (!isObject(data)) return null;
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (data.language === null || isLocale(data.language)) out.language = data.language;
  if (data.theme === 'light' || data.theme === 'dark' || data.theme === 'system') out.theme = data.theme;
  if (data.mistakeLimit === 3 || data.mistakeLimit === null) out.mistakeLimit = data.mistakeLimit;
  for (const key of ['highlightConflicts', 'highlightSameDigit', 'autoRemoveNotes', 'showTimer'] as const) {
    if (typeof data[key] === 'boolean') out[key] = data[key];
  }
  return out;
}
