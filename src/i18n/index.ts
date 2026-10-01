import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { settingsStore } from '../store/settingsStore';
import ar from './locales/ar.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from './locales';

// All locales are bundled so every language works offline.
export const resources = {
  en: { translation: en },
  fr: { translation: fr },
  ar: { translation: ar },
} satisfies Record<Locale, unknown>;

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
  // Resources are bundled, so initialise synchronously: the prerenderer renders straight away.
  initAsync: false,
});

export default i18n;

/** Saved setting → browser language → English. (The URL prefix, when present, wins over all of these.) */
export function resolveLocale(): Locale {
  const saved = settingsStore.getState().language;
  if (saved) return saved;
  if (typeof navigator !== 'undefined') {
    for (const tag of navigator.languages ?? [navigator.language]) {
      const base = tag?.slice(0, 2).toLowerCase();
      if (isLocale(base)) return base;
    }
  }
  return DEFAULT_LOCALE;
}

export function localeDir(locale: Locale): 'ltr' | 'rtl' {
  return LOCALES.find((l) => l.code === locale)?.dir ?? 'ltr';
}

/** Switches i18next and the <html> lang/dir attributes. */
export function applyLocale(locale: Locale): void {
  if (i18n.language !== locale) void i18n.changeLanguage(locale);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDir(locale);
  }
}
