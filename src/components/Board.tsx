import { useTranslation } from 'react-i18next';
import { useGame, useUi } from '../store/hooks';
import { Cell } from './Cell';

const ROWS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function Board() {
  const { t } = useTranslation();
  const ready = useGame((s) => s.game !== null);
  const paused = useGame((s) => s.game?.status === 'paused');
  const generating = useUi((s) => s.generating);

  return (
    // Fixed aspect ratio → no layout shift. Always LTR so rows/columns read the same in every language.
    <div dir="ltr" className="relative aspect-square w-full">
      {ready && (
        <div
          role="grid"
          aria-label={t('board.label')}
          data-board
          className={`grid h-full w-full grid-rows-9 overflow-hidden rounded-lg border-2 border-line-strong bg-surface transition-[filter] ${
            paused ? 'pointer-events-none blur-md' : ''
          }`}
        >
          {ROWS.map((r) => (
            <div role="row" key={r} className="grid grid-cols-9">
              {ROWS.map((c) => (
                <Cell key={c} index={r * 9 + c} />
              ))}
            </div>
          ))}
        </div>
      )}
      {(!ready || generating) && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-line bg-surface/80">
          <span role="status" className="flex items-center gap-3 text-muted">
            <span className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
            {t('common.loading')}
          </span>
        </div>
      )}
    </div>
  );
}
