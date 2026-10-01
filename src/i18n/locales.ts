/** Supported languages. Adding one = a new locale JSON file + an entry here. */
export const LOCALES = [
  { code: 'en', dir: 'ltr', nativeName: 'English' },
  { code: 'fr', dir: 'ltr', nativeName: 'Français' },
  { code: 'ar', dir: 'rtl', nativeName: 'العربية' },
] as const;

export type Locale = (typeof LOCALES)[number]['code'];

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((l) => l.code === value);
}
