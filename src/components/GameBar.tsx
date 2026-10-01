import { Pause, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../hooks/useLocaleRoute';
import { formatDate, formatTime } from '../i18n/format';
import { gameStore } from '../store/gameStore';
import { useGame, useSettings } from '../store/hooks';

function Timer() {
  const locale = useLocale();
  // Re-render once per second, not on every tick.
  const seconds = useGame((s) => Math.floor((s.game?.elapsedMs ?? 0) / 1000));
  return <span className="tabular-nums">{formatTime(seconds * 1000, locale)}</span>;
}

/** Difficulty, mistakes and timer above the board. */
export function GameBar() {
  const { t } = useTranslation();
  const locale = useLocale();
  const puzzle = useGame((s) => s.game?.puzzle);
  const mistakes = useGame((s) => s.game?.mistakes ?? 0);
  const paused = useGame((s) => s.game?.status === 'paused');
  const playing = useGame((s) => s.game?.status === 'playing');
  const limit = useSettings((s) => s.mistakeLimit);
  const showTimer = useSettings((s) => s.showTimer);

  if (!puzzle) return <div className="h-10" />;
  const dailyKey = puzzle.id.startsWith('daily-') ? puzzle.id.slice(6) : null;
  const dailyDate = dailyKey ? new Date(`${dailyKey}T12:00:00`) : null;

  return (
    <div className="flex h-10 items-center justify-between gap-2 text-sm text-muted">
      <span className="font-medium text-fg">
        {dailyDate
          ? t('game.dailyLabel', { date: formatDate(dailyDate, locale, { day: 'numeric', month: 'short' }) })
          : t(`difficulty.${puzzle.difficulty}`)}
      </span>
      <span className={`tabular-nums ${mistakes > 0 ? 'text-error' : ''}`}>
        {t('common.labelValue', {
          label: t('game.mistakes'),
          value: limit === null ? mistakes : t('game.mistakesValue', { value: mistakes, max: limit }),
        })}
      </span>
      <span className="flex items-center gap-1">
        {showTimer && <Timer />}
        <button
          type="button"
          disabled={!playing && !paused}
          onClick={() => (paused ? gameStore.getState().resume() : gameStore.getState().pause())}
          aria-label={paused ? t('game.resume') : t('game.pause')}
          className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-40"
        >
          {paused ? <Play className="size-5" aria-hidden="true" /> : <Pause className="size-5" aria-hidden="true" />}
        </button>
      </span>
    </div>
  );
}
