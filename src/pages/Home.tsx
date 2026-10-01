import { CalendarDays, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useNewGame } from '../components/modals/GameModals';
import { useLocale, useLocalePath } from '../hooks/useLocaleRoute';
import { formatTime } from '../i18n/format';
import { dailyStreaks, dateKey } from '../logic/daily';
import { DIFFICULTIES } from '../logic/types';
import { useSeo } from '../seo/useSeo';
import { useGame, useStats } from '../store/hooks';

export function HomePage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const newGame = useNewGame();
  const game = useGame((s) => s.game);
  const completed = useStats((s) => s.dailyCompleted);
  const today = dateKey();
  const todayDone = completed.includes(today);
  const streak = dailyStreaks(completed, today).current;
  useSeo({ title: t('seo.home.title'), description: t('seo.home.description') });

  const resumable = game && (game.status === 'playing' || game.status === 'paused') ? game : null;
  const resumePath = resumable?.puzzle.id.startsWith('daily-')
    ? path(`/daily/${resumable.puzzle.id.slice(6)}`)
    : path(`/play/${resumable?.puzzle.difficulty}`);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">{t('app.name')}</h1>
        <p className="mt-2 text-muted">{t('app.tagline')}</p>
      </div>

      {resumable && (
        <Link
          to={resumePath}
          className="flex items-center gap-4 rounded-2xl bg-accent p-5 text-accent-fg shadow-sm hover:opacity-95"
        >
          <Play className="size-8 shrink-0 rtl:-scale-x-100" aria-hidden="true" />
          <span className="flex flex-col">
            <span className="text-lg font-semibold">{t('home.continue')}</span>
            <span className="text-sm opacity-90">
              {t('home.continueDetail', {
                difficulty: t(`difficulty.${resumable.puzzle.difficulty}`),
                time: formatTime(resumable.elapsedMs, locale),
              })}
            </span>
          </span>
        </Link>
      )}

      <section aria-labelledby="new-game" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="new-game" className="mb-3 font-semibold">
          {t('home.newGame')}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => newGame(d)}
              className="min-h-12 rounded-xl bg-surface-2 px-3 font-medium hover:bg-cell-same"
            >
              {t(`difficulty.${d}`)}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="daily" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="daily" className="flex items-center gap-2 font-semibold">
          <CalendarDays className="size-5 text-accent" aria-hidden="true" />
          {t('home.dailyTitle')}
        </h2>
        {streak > 0 && (
          <p className="mt-1 text-sm text-muted">
            {t('common.labelValue', { label: t('stats.currentStreak'), value: t('stats.days', { count: streak }) })}
          </p>
        )}
        {todayDone ? (
          <p className="mt-3 text-sm">{t('home.dailyDone')}</p>
        ) : (
          <Link
            to={path(`/daily/${today}`)}
            className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-accent font-medium text-accent-fg"
          >
            {t('home.dailyPlay')}
          </Link>
        )}
      </section>
    </div>
  );
}
