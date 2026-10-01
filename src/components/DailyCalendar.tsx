import { Award, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLocale, useLocalePath } from '../hooks/useLocaleRoute';
import { formatDate, weekStart } from '../i18n/format';
import { dateKey } from '../logic/daily';

interface Props {
  today: string;
  completed: readonly string[];
}

/** Earliest month the calendar lets you browse back to. */
const HISTORY_MONTHS = 12;

const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

export function DailyCalendar({ today, completed }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const [ty, tm] = today.split('-').map(Number);
  const [offset, setOffset] = useState(0); // months back from the current one
  const view = new Date(ty, tm - 1 - offset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const done = new Set(completed);

  const count = daysInMonth(year, month);
  const days = Array.from({ length: count }, (_, i) => dateKey(new Date(year, month, i + 1)));
  const lead = (view.getDay() - weekStart(locale) + 7) % 7;
  const monthComplete = days.every((d) => done.has(d));
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    // 2023-01-01 was a Sunday.
    formatDate(new Date(2023, 0, 1 + ((weekStart(locale) + i) % 7)), locale, { weekday: 'narrow' }),
  );

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          disabled={offset >= HISTORY_MONTHS}
          aria-label={t('daily.prevMonth')}
          className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-30"
        >
          <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden="true" />
        </button>
        <h2 className="font-semibold" aria-live="polite">
          {formatDate(view, locale, { month: 'long', year: 'numeric' })}
        </h2>
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          disabled={offset === 0}
          aria-label={t('daily.nextMonth')}
          className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-30"
        >
          <ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden="true" />
        </button>
      </div>

      {monthComplete && (
        <p className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-hint-focus p-2 text-sm font-semibold">
          <Award className="size-5" aria-hidden="true" />
          {t('daily.badge')}
        </p>
      )}

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted" aria-hidden="true">
        {weekdays.map((w, i) => (
          <span key={i} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <li key={`pad-${i}`} aria-hidden="true" />
        ))}
        {days.map((key, i) => {
          const label = formatDate(new Date(year, month, i + 1), locale, { day: 'numeric', month: 'long' });
          const isToday = key === today;
          const base = `flex aspect-square items-center justify-center rounded-full text-sm tabular-nums ${isToday ? 'ring-2 ring-accent' : ''}`;
          if (key > today) {
            return (
              <li key={key}>
                <span className={`${base} text-muted`} aria-label={t('daily.dayFuture', { date: label })}>
                  {i + 1}
                </span>
              </li>
            );
          }
          const isDone = done.has(key);
          return (
            <li key={key}>
              <Link
                to={path(`/daily/${key}`)}
                aria-label={t(isDone ? 'daily.dayCompleted' : 'daily.dayAvailable', { date: label })}
                aria-current={isToday ? 'date' : undefined}
                className={`${base} ${isDone ? 'bg-accent font-semibold text-accent-fg' : 'font-semibold text-fg underline decoration-line underline-offset-4 hover:bg-surface-2'}`}
              >
                {isDone ? <Check className="size-4" aria-hidden="true" /> : i + 1}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
