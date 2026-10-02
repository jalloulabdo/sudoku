import { Trophy } from 'lucide-react';
import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { useLocale, useLocalePath } from '../hooks/useLocaleRoute';
import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { formatNumber, formatTime } from '../i18n/format';
import { dateKey } from '../logic/daily';
import { BASE_POINTS, PAR_MS } from '../logic/points';
import { DIFFICULTIES } from '../logic/types';
import { useSeo } from '../seo/useSeo';
import { useAccount } from '../store/hooks';

type Period = 'all' | 'week' | 'daily';
const PERIODS: Period[] = ['all', 'week', 'daily'];

interface Entry {
  rank: number;
  username: string;
  points: number;
  games?: number;
  elapsedMs?: number;
}
interface Board {
  entries: Entry[];
  me: Entry | null;
}

function useLeaderboard(period: Period) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error' | 'offline'; board?: Board }>({ status: 'loading' });
  const load = useCallback(() => {
    setState((s) => ({ status: 'loading', board: s.board }));
    const query = period === 'daily' ? `period=daily&date=${dateKey()}` : `period=${period}`;
    api<Board>(`/api/leaderboard?${query}`)
      .then((board) => setState({ status: 'ready', board }))
      .catch((err) => setState({ status: err instanceof ApiError && err.code === 'network' ? 'offline' : 'error' }));
  }, [period]);
  useEffect(load, [load]);
  return { ...state, reload: load };
}

function HowPoints() {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <details className="group rounded-2xl border border-line bg-surface px-5 py-3">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
        <h2>{t('leaderboard.howPointsTitle')}</h2>
      </summary>
      <p className="mt-2 text-sm leading-relaxed text-muted">{t('leaderboard.howPointsText')}</p>
      <table className="mt-3 w-full text-sm">
        <thead className="text-muted">
          <tr>
            <th scope="col" className="py-1 text-start font-medium">{t('stats.difficulty')}</th>
            <th scope="col" className="py-1 text-end font-medium">{t('leaderboard.basePoints')}</th>
            <th scope="col" className="py-1 text-end font-medium">{t('leaderboard.targetTime')}</th>
          </tr>
        </thead>
        <tbody>
          {DIFFICULTIES.map((d) => (
            <tr key={d} className="border-t border-line">
              <th scope="row" className="py-1.5 text-start font-medium">{t(`difficulty.${d}`)}</th>
              <td className="py-1.5 text-end tabular-nums">{formatNumber(BASE_POINTS[d], locale)}</td>
              <td className="py-1.5 text-end tabular-nums">{formatTime(PAR_MS[d], locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function LeaderboardPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const offline = useOfflineStatus();
  const user = useAccount((s) => s.user);
  const [period, setPeriod] = useState<Period>('all');
  const { status, board, reload } = useLeaderboard(period);
  useSeo({ title: t('seo.leaderboard.title'), description: t('seo.leaderboard.description') });

  // Arrow keys move between tabs (WAI-ARIA tabs pattern); visual order follows the page direction.
  const onTabKey = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const dir = document.documentElement.dir === 'rtl' ? -step : step;
    const next = PERIODS[(PERIODS.indexOf(period) + dir + PERIODS.length) % PERIODS.length];
    setPeriod(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  const showMe = board?.me && !board.entries.some((e) => e.username === board.me!.username);
  const row = (e: Entry, mine: boolean) => (
    <tr key={`${e.rank}-${e.username}`} className={`border-t border-line ${mine ? 'bg-cell-same font-semibold' : ''}`}>
      <td className="px-3 py-2.5 tabular-nums">{formatNumber(e.rank, locale)}</td>
      <td className="max-w-40 truncate px-3 py-2.5">
        {e.username}
        {mine && <span className="ms-2 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-fg">{t('leaderboard.you')}</span>}
      </td>
      <td className="px-3 py-2.5 text-end tabular-nums">{formatNumber(e.points, locale)}</td>
      <td className="px-3 py-2.5 text-end tabular-nums">
        {period === 'daily' ? formatTime(e.elapsedMs ?? 0, locale) : formatNumber(e.games ?? 0, locale)}
      </td>
    </tr>
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Trophy className="size-7 text-accent" aria-hidden="true" />
          {t('leaderboard.title')}
        </h1>
        <p className="mt-2 text-muted">{t('leaderboard.intro')}</p>
      </header>

      {!user ? (
        <p className="rounded-xl bg-surface-2 p-3 text-sm">
          {t('leaderboard.signIn')}{' '}
          <Link to={path('/login')} className="font-semibold text-accent underline">
            {t('account.signIn')}
          </Link>
        </p>
      ) : (
        !user.username && (
          <p className="rounded-xl bg-hint-focus p-3 text-sm">
            <Link to={path('/profile')} className="underline">
              {t('leaderboard.chooseUsername')}
            </Link>
          </p>
        )
      )}

      <HowPoints />

      <div role="tablist" aria-label={t('leaderboard.tabs.label')} className="flex gap-1 rounded-xl bg-surface-2 p-1" onKeyDown={onTabKey}>
        {PERIODS.map((p) => (
          <button
            key={p}
            id={`tab-${p}`}
            role="tab"
            type="button"
            aria-selected={period === p}
            aria-controls="leaderboard-panel"
            tabIndex={period === p ? 0 : -1}
            onClick={() => setPeriod(p)}
            className="min-h-11 flex-1 rounded-lg px-2 text-sm aria-selected:bg-surface aria-selected:font-semibold aria-selected:shadow-sm"
          >
            {t(`leaderboard.tabs.${p}`)}
          </button>
        ))}
      </div>

      {/* Reserved height: the panel changes size as it loads, and must not push the footer around (CLS). */}
      <div id="leaderboard-panel" role="tabpanel" aria-labelledby={`tab-${period}`} aria-busy={status === 'loading'} className="min-h-[32rem]">
        {status === 'offline' || (offline && !board) ? (
          <p className="rounded-xl bg-surface-2 p-4 text-center text-sm">{t('leaderboard.offline')}</p>
        ) : status === 'error' ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-surface-2 p-4 text-sm">
            <p>{t('leaderboard.error')}</p>
            <button type="button" onClick={reload} className="min-h-11 rounded-xl bg-accent px-4 font-medium text-accent-fg">
              {t('leaderboard.retry')}
            </button>
          </div>
        ) : !board ? (
          <p role="status" className="p-4 text-center text-sm text-muted">
            {t('account.loading')}
          </p>
        ) : board.entries.length === 0 ? (
          <p className="rounded-xl bg-surface-2 p-4 text-center text-sm">{t('leaderboard.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start font-medium">{t('leaderboard.rank')}</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">{t('leaderboard.player')}</th>
                  <th scope="col" className="px-3 py-2 text-end font-medium">{t('leaderboard.points')}</th>
                  <th scope="col" className="px-3 py-2 text-end font-medium">{period === 'daily' ? t('leaderboard.time') : t('leaderboard.games')}</th>
                </tr>
              </thead>
              <tbody>
                {board.entries.map((e) => row(e, e.username === user?.username))}
                {showMe && board.me && row(board.me, true)}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
