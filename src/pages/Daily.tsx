import { Flame, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { DailyCalendar } from '../components/DailyCalendar';
import { useLocalePath } from '../hooks/useLocaleRoute';
import { dailyStreaks, dateKey } from '../logic/daily';
import { useSeo } from '../seo/useSeo';
import { useStats } from '../store/hooks';

export function DailyPage() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const completed = useStats((s) => s.dailyCompleted);
  const today = dateKey();
  const { current, best } = dailyStreaks(completed, today);
  const todayDone = completed.includes(today);
  useSeo({ title: t('seo.daily.title'), description: t('seo.daily.description') });

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">{t('daily.title')}</h1>
        <p className="mt-1 text-muted">{t('daily.text')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Flame className="size-4" aria-hidden="true" />
            {t('stats.currentStreak')}
          </p>
          <p className="mt-1 text-lg font-semibold">{t('stats.days', { count: current })}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Trophy className="size-4" aria-hidden="true" />
            {t('stats.bestStreak')}
          </p>
          <p className="mt-1 text-lg font-semibold">{t('stats.days', { count: best })}</p>
        </div>
      </div>

      {todayDone ? (
        <p className="rounded-xl bg-surface-2 p-3 text-center text-sm">{t('daily.todayDone')}</p>
      ) : (
        <Link
          to={path(`/daily/${today}`)}
          className="flex min-h-12 items-center justify-center rounded-xl bg-accent font-medium text-accent-fg"
        >
          {t('daily.playToday')}
        </Link>
      )}

      <DailyCalendar today={today} completed={completed} />
    </div>
  );
}
