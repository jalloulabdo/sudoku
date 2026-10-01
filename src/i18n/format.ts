import type { Locale } from './locales';

/**
 * Intl locale tag. Arabic uses Western digits (latn) so the timer and stats match the
 * 1–9 digits on the grid.
 */
export function intlLocale(locale: Locale): string {
  return locale === 'ar' ? 'ar-u-nu-latn' : locale;
}

/** mm:ss, or h:mm:ss after an hour. */
export function formatTime(ms: number, locale: Locale): string {
  const total = Math.floor(ms / 1000);
  const two = new Intl.NumberFormat(intlLocale(locale), { minimumIntegerDigits: 2 });
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${new Intl.NumberFormat(intlLocale(locale)).format(h)}:${two.format(m)}:${two.format(s)}` : `${two.format(m)}:${two.format(s)}`;
}

export function formatPercent(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: 'percent', maximumFractionDigits: 0 }).format(value);
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

export function formatDate(date: Date, locale: Locale, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(date);
}

/** First day of the week shown in the calendar: Sunday for English, Monday otherwise. */
export function weekStart(locale: Locale): number {
  return locale === 'en' ? 0 : 1;
}
