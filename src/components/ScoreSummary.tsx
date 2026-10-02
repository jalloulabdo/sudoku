import { Medal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLocalePath } from '../hooks/useLocaleRoute';
import type { Difficulty } from '../logic/types';
import { useAccount, useUi } from '../store/hooks';

/** The ranked result of a won game, shown in the win dialog. */
export function ScoreSummary({ puzzleId, difficulty }: { puzzleId: string; difficulty: Difficulty }) {
  const { t } = useTranslation();
  const path = useLocalePath();
  const signedIn = useAccount((s) => s.status === 'signedIn');
  const score = useUi((s) => (s.score?.puzzleId === puzzleId ? s.score : null));
  const note = (text: string) => <p className="rounded-xl bg-surface-2 p-3 text-center text-sm">{text}</p>;

  if (!signedIn) {
    return (
      <p className="rounded-xl bg-surface-2 p-3 text-center text-sm">
        {t('score.signIn')}{' '}
        <Link to={path('/login')} className="font-semibold text-accent underline">
          {t('score.signInLink')}
        </Link>
      </p>
    );
  }
  if (!score) return note(t('score.notRanked'));
  switch (score.state) {
    case 'submitting':
      return note(t('score.submitting'));
    case 'queued':
      return note(t('score.queued'));
    case 'rejected':
      return note(t('score.rejected'));
    case 'unranked':
      return note(
        t(score.reason === 'offline' ? 'score.startedOffline' : score.reason === 'alreadyScored' ? 'score.alreadyScored' : score.reason === 'signedOut' ? 'score.signIn' : 'score.notRanked'),
      );
    case 'scored':
      return (
        <div className="rounded-xl bg-hint-focus p-4 text-fg" aria-live="polite">
          <p className="flex items-center justify-center gap-2 text-2xl font-bold">
            <Medal className="size-6" aria-hidden="true" />
            <span dir="ltr">{t('score.earned', { points: score.points })}</span>
          </p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt>{t('score.base', { difficulty: t(`difficulty.${difficulty}`) })}</dt>
              <dd className="tabular-nums">{score.base}</dd>
            </div>
            {score.timeBonus > 0 && (
              <div className="flex justify-between gap-2">
                <dt>{t('score.timeBonus')}</dt>
                <dd className="tabular-nums" dir="ltr">+{score.timeBonus}</dd>
              </div>
            )}
            {score.penalty > 0 && (
              <div className="flex justify-between gap-2">
                <dt>{t('score.penalty')}</dt>
                <dd className="tabular-nums" dir="ltr">−{score.penalty}</dd>
              </div>
            )}
          </dl>
          {score.dailyRank !== null && <p className="mt-2 text-center text-sm font-semibold">{t('score.dailyRank', { rank: score.dailyRank })}</p>}
          <p className="mt-2 text-center">
            <Link to={path('/leaderboard')} className="text-sm font-medium underline">
              {t('score.viewLeaderboard')}
            </Link>
          </p>
        </div>
      );
  }
}
