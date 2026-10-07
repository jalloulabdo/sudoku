import { BarChart3, CalendarCheck2, Flame, Play, Trophy } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useLocale, useLocalePath } from '../../hooks/useLocaleRoute';
import { formatDate, formatNumber, formatPercent, formatTime } from '../../i18n/format';
import { addDays, dailyStreaks, dateKey } from '../../logic/daily';
import { DIFFICULTIES } from '../../logic/types';
import { useAccount, useGame, useStats } from '../../store/hooks';
import { Reveal } from './Reveal';

/** Same height for every card, so data arriving after the first paint never shifts the layout. */
function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="lift flex min-h-[15rem] flex-col rounded-3xl border border-line bg-surface p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-muted">
        <span className="flex size-8 items-center justify-center rounded-xl bg-brand text-white">{icon}</span>
        {title}
      </h3>
      <div className="mt-4 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

const cardLink = 'mt-auto inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold';
const primary = `${cardLink} bg-accent text-accent-fg`;
const secondary = `${cardLink} border border-line hover:bg-surface-2`;

function ProgressRing({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} />
    </svg>
  );
}

function ContinueCard() {
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const game = useGame((s) => (s.game && (s.game.status === 'playing' || s.game.status === 'paused') ? s.game : null));

  if (!game) {
    return (
      <Card icon={<Play className="size-4 rtl:-scale-x-100" aria-hidden="true" />} title={t('home.dash.continue.title')}>
        <p className="text-muted">{t('home.dash.continue.empty')}</p>
        <Link to={path('/play/easy')} className={primary}>
          {t('home.dash.continue.start')}
        </Link>
      </Card>
    );
  }
  const empty = game.puzzle.givens.filter((v) => v === null).length;
  const solved = game.cells.filter((c, i) => !c.given && c.value === game.puzzle.solution[i]).length;
  const progress = empty ? solved / empty : 0;
  const daily = game.puzzle.id.startsWith('daily-');
  return (
    <Card icon={<Play className="size-4 rtl:-scale-x-100" aria-hidden="true" />} title={t('home.dash.continue.title')}>
      <div className="flex items-center gap-4">
        <div className="relative">
          <ProgressRing value={progress} />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums">{formatPercent(progress, locale)}</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{daily ? t('home.dailyTitle') : t(`difficulty.${game.puzzle.difficulty}`)}</p>
          <p className="text-sm text-muted tabular-nums">
            {formatTime(game.elapsedMs, locale)} · {formatPercent(progress, locale)} {t('home.dash.continue.complete')}
          </p>
        </div>
      </div>
      <Link to={daily ? path(`/daily/${game.puzzle.id.slice(6)}`) : path(`/play/${game.puzzle.difficulty}`)} className={primary}>
        {t('home.dash.continue.resume')}
      </Link>
    </Card>
  );
}

function DailyCard() {
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const completed = useStats((s) => s.dailyCompleted);
  const today = dateKey();
  const { current } = dailyStreaks(completed, today);
  const done = new Set(completed);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  return (
    <Card icon={<CalendarCheck2 className="size-4" aria-hidden="true" />} title={t('home.dash.daily.title')}>
      <p className="flex items-center gap-2">
        <Flame className="size-6 text-error" aria-hidden="true" />
        <span className="text-2xl font-bold">{t('stats.days', { count: current })}</span>
      </p>
      <p className="text-xs text-muted">{t('home.dash.daily.streak')}</p>
      <ol className="mt-3 flex justify-between gap-1" aria-label={t('home.dash.daily.week')}>
        {week.map((key) => {
          const d = new Date(`${key}T12:00:00`);
          const label = formatDate(d, locale, { weekday: 'long', day: 'numeric', month: 'long' });
          const isDone = done.has(key);
          return (
            <li key={key} className="flex flex-col items-center gap-1" aria-label={t(isDone ? 'home.dash.daily.dayDone' : 'home.dash.daily.dayMissed', { day: label })}>
              <span aria-hidden="true" className="text-[0.65rem] text-muted">
                {formatDate(d, locale, { weekday: 'narrow' })}
              </span>
              <span
                aria-hidden="true"
                className={`size-6 rounded-full border-2 ${isDone ? 'border-transparent bg-brand' : key === today ? 'border-accent' : 'border-line'}`}
              />
            </li>
          );
        })}
      </ol>
      {done.has(today) ? (
        <p className="mt-auto pt-3 text-sm font-medium">{t('home.dash.daily.done')}</p>
      ) : (
        <Link to={path(`/daily/${today}`)} className={`${primary} mt-4`}>
          {t('home.dash.daily.play')}
        </Link>
      )}
    </Card>
  );
}

function ProgressCard() {
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const byDifficulty = useStats((s) => s.byDifficulty);
  const all = DIFFICULTIES.map((d) => byDifficulty[d]);
  const won = all.reduce((n, s) => n + s.won, 0);
  const started = all.reduce((n, s) => n + s.started, 0);
  const bests = all.map((s) => s.bestMs).filter((v): v is number => v !== null);
  const items: [string, string][] = [
    [t('home.dash.progress.solved'), formatNumber(won, locale)],
    [t('home.dash.progress.winRate'), started ? formatPercent(won / started, locale) : t('stats.none')],
    [t('home.dash.progress.best'), bests.length ? formatTime(Math.min(...bests), locale) : t('stats.none')],
  ];
  return (
    <Card icon={<BarChart3 className="size-4" aria-hidden="true" />} title={t('home.dash.progress.title')}>
      <dl className="space-y-2.5">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <Link to={path('/stats')} className={`${secondary} mt-4`}>
        {t('home.dash.progress.view')}
      </Link>
    </Card>
  );
}

function RankCard() {
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const signedIn = useAccount((s) => s.status === 'signedIn');
  const [scores, setScores] = useState<{ points: number; rank: number | null } | null>(null);
  useEffect(() => {
    if (signedIn) api<{ points: number; rank: number | null }>('/api/me/scores').then(setScores, () => {});
  }, [signedIn]);

  return (
    <Card icon={<Trophy className="size-4" aria-hidden="true" />} title={t('home.dash.rank.title')}>
      {signedIn ? (
        <>
          <dl className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-surface-2 p-3">
              <dt className="text-xs text-muted">{t('home.dash.rank.points')}</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums">{scores ? formatNumber(scores.points, locale) : t('stats.none')}</dd>
            </div>
            <div className="rounded-2xl bg-surface-2 p-3">
              <dt className="text-xs text-muted">{t('home.dash.rank.rank')}</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums">{scores?.rank ? `#${formatNumber(scores.rank, locale)}` : t('stats.none')}</dd>
            </div>
          </dl>
          <Link to={path('/leaderboard')} className={`${secondary} mt-4`}>
            {t('home.dash.rank.view')}
          </Link>
        </>
      ) : (
        <>
          <p className="text-muted">{t('home.dash.rank.signIn')}</p>
          <Link to={path('/login')} className={`${primary} mt-4`}>
            {t('home.dash.rank.signInButton')}
          </Link>
        </>
      )}
    </Card>
  );
}

export function Dashboard() {
  const { t } = useTranslation();
  return (
    <Reveal aria-labelledby="dashboard" className="mx-auto w-full max-w-6xl px-4 py-12">
      <h2 id="dashboard" className="text-2xl font-bold sm:text-3xl">
        {t('home.dash.title')}
      </h2>
      <p className="mt-2 text-muted">{t('home.dash.text')}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ContinueCard />
        <DailyCard />
        <ProgressCard />
        <RankCard />
      </div>
    </Reveal>
  );
}
