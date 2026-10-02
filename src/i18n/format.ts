import type { Locale } from './locales';

/**
 * Intl locale tag. Arabic uses Western digits (latn) so the timer and stats match the
 * 1–9 digits on the grid.
 */
export function intlLocale(locale: Locale): string {
  return locale === 'ar' ? 'ar-u-nu-latn' : locale;
}

// Creating Intl formatters is expensive (it was the top main-thread cost while loading a
// game), so each locale/options combination is built once and reused.
const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function numberFormat(locale: Locale, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = numberFormats.get(key);
  if (!f) numberFormats.set(key, (f = new Intl.NumberFormat(intlLocale(locale), options)));
  return f;
}

function dateFormat(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = dateFormats.get(key);
  if (!f) dateFormats.set(key, (f = new Intl.DateTimeFormat(intlLocale(locale), options)));
  return f;
}

/**
 * mm:ss, or h:mm:ss after an hour. Every supported locale uses Western digits (see intlLocale),
 * so plain padding gives the same result as Intl without loading locale data on the game page.
 */
export function formatTime(ms: number, _locale: Locale): string {
  const total = Math.floor(ms / 1000);
  const two = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

export function formatPercent(value: number, locale: Locale): string {
  return numberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(value);
}

export function formatNumber(value: number, locale: Locale): string {
  return numberFormat(locale).format(value);
}

export function formatDate(date: Date, locale: Locale, options: Intl.DateTimeFormatOptions): string {
  return dateFormat(locale, options).format(date);
}

/** First day of the week shown in the calendar: Sunday for English, Monday otherwise. */
export function weekStart(locale: Locale): number {
  return locale === 'en' ? 0 : 1;
}
