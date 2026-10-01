import { Eraser, Lightbulb, Pencil, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import type { Digit } from '../logic/types';
import { gameStore } from '../store/gameStore';
import { useGame } from '../store/hooks';

const DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** How many of each digit still need to be placed (givens and correct entries count as placed). */
function remainingCounts(s: ReturnType<typeof gameStore.getState>): number[] {
  const g = s.game;
  const left = new Array<number>(9).fill(9);
  if (!g) return left;
  g.cells.forEach((c, i) => {
    if (c.value !== null && c.value === g.puzzle.solution[i]) left[c.value - 1]--;
  });
  return left;
}

function ActionButton(props: { label: string; onClick: () => void; children: ReactNode; pressed?: boolean; badge?: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.pressed}
      className="relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg aria-pressed:text-accent"
    >
      {props.children}
      <span>{props.label}</span>
      {props.badge && (
        // Anchored at the icon's centre and pushed past its edge, so longer labels grow away from it.
        <span className="absolute start-1/2 top-0 ms-2.5 rounded-full border border-line bg-surface px-1.5 text-[0.65rem] leading-4 font-semibold text-fg">
          {props.badge}
        </span>
      )}
    </button>
  );
}

export function Keypad() {
  const { t } = useTranslation();
  const left = useGame(useShallow(remainingCounts));
  const notesMode = useGame((s) => s.game?.notesMode ?? false);
  const s = gameStore.getState;

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex gap-1">
        <ActionButton label={t('keypad.undo')} onClick={() => s().undo()}>
          <Undo2 className="size-6 rtl:-scale-x-100" aria-hidden="true" />
        </ActionButton>
        <ActionButton label={t('keypad.erase')} onClick={() => s().erase()}>
          <Eraser className="size-6" aria-hidden="true" />
        </ActionButton>
        <ActionButton
          label={t('keypad.notes')}
          onClick={() => s().toggleNotesMode()}
          pressed={notesMode}
          badge={notesMode ? t('keypad.notesOn') : t('keypad.notesOff')}
        >
          <Pencil className="size-6" aria-hidden="true" />
        </ActionButton>
        <ActionButton label={t('keypad.hint')} onClick={() => s().hint()}>
          <Lightbulb className="size-6" aria-hidden="true" />
        </ActionButton>
      </div>

      <div role="group" aria-label={t('keypad.label')} className="grid grid-cols-9 gap-1 lg:grid-cols-3 lg:gap-2">
        {DIGITS.map((d) => {
          const done = left[d - 1] <= 0;
          return (
            <button
              key={d}
              type="button"
              disabled={done}
              aria-label={t('keypad.digit', { digit: d, left: Math.max(0, left[d - 1]) })}
              onClick={() => s().input(d)}
              className={`flex min-h-14 flex-col items-center justify-center rounded-xl bg-surface-2 transition-colors hover:bg-cell-same disabled:invisible lg:aspect-[4/3] ${
                notesMode ? 'text-muted' : 'text-entry'
              }`}
            >
              <span className="text-[clamp(1.4rem,6vw,2rem)] leading-none font-medium">{d}</span>
              {/* Shown via CSS so the button's visible text is just the digit, matching its accessible name. */}
              <span
                aria-hidden="true"
                data-left={left[d - 1]}
                className="text-[0.65rem] text-muted after:content-[attr(data-left)]"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
