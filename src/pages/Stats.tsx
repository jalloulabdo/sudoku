import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalButton } from '../components/modals/Modal';
import { useLocale } from '../hooks/useLocaleRoute';
import { formatNumber, formatPercent, formatTime } from '../i18n/format';
import { dailyStreaks, dateKey } from '../logic/daily';
import { DIFFICULTIES } from '../logic/types';
import { useSeo } from '../seo/useSeo';
import { useStats } from '../store/hooks';
import { averageMs, statsStore, winRate } from '../store/statsStore';

export function StatsPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const byDifficulty = useStats((s) => s.byDifficulty);
  const completed = useStats((s) => s.dailyCompleted);
  const [confirming, setConfirming] = useState(false);
  const { current, best } = dailyStreaks(completed, dateKey());
  useSeo({ title: t('seo.stats.title'), description: t('seo.stats.description'), noindex: true });
  const time = (ms: number | null) => (ms === null ? t('stats.none') : formatTime(ms, locale));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{t('stats.title')}</h1>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted">
            <tr>
              {['difficulty', 'played', 'won', 'winRate', 'best', 'average'].map((k) => (
                <th key={k} scope="col" className="px-3 py-2 text-start font-medium whitespace-nowrap">
                  {t(`stats.${k}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIFFICULTIES.map((d) => {
              const s = byDifficulty[d];
              return (
                <tr key={d} className="border-t border-line">
                  <th scope="row" className="px-3 py-3 text-start font-medium">
                    {t(`difficulty.${d}`)}
                  </th>
                  <td className="px-3 py-3 tabular-nums">{formatNumber(s.started, locale)}</td>
                  <td className="px-3 py-3 tabular-nums">{formatNumber(s.won, locale)}</td>
                  <td className="px-3 py-3 tabular-nums">{s.started ? formatPercent(winRate(s), locale) : t('stats.none')}</td>
                  <td className="px-3 py-3 tabular-nums">{time(s.bestMs)}</td>
                  <td className="px-3 py-3 tabular-nums">{time(averageMs(s))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">{t('stats.dailyTitle')}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-muted">{t('stats.currentStreak')}</dt>
            <dd className="text-lg font-semibold">{t('stats.days', { count: current })}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t('stats.bestStreak')}</dt>
            <dd className="text-lg font-semibold">{t('stats.days', { count: best })}</dd>
          </div>
        </dl>
      </section>

      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-11 self-start rounded-xl px-4 text-sm font-medium text-error hover:bg-cell-conflict"
      >
        {t('stats.reset')}
      </button>

      <Modal open={confirming} title={t('stats.resetTitle')} onClose={() => setConfirming(false)}>
        <p className="text-muted">{t('stats.resetText')}</p>
        <div className="mt-5 flex flex-col gap-2">
          <ModalButton
            variant="danger"
            onClick={() => {
              statsStore.getState().reset();
              setConfirming(false);
            }}
          >
            {t('stats.resetConfirm')}
          </ModalButton>
          <ModalButton onClick={() => setConfirming(false)}>{t('common.cancel')}</ModalButton>
        </div>
      </Modal>
    </div>
  );
}
