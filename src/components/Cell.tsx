import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { COL_OF, PEERS, ROW_OF, bit, digitsOf, isPeer } from '../logic/board';
import type { CellIndex } from '../logic/types';
import type { GameStore } from '../store/gameStore';
import { gameStore } from '../store/gameStore';
import { useGame, useSettings } from '../store/hooks';

interface CellView {
  value: number | null;
  given: boolean;
  notes: number;
  wrong: boolean;
  selected: boolean;
  tabbable: boolean;
  peer: boolean;
  same: boolean;
  conflict: boolean;
  hintFocus: boolean;
  hintTarget: boolean;
  /** Digit to emphasise among the notes (the selected cell's digit). */
  noteDigit: number;
}

function cellView(s: GameStore, i: CellIndex, conflicts: boolean, sameDigit: boolean): CellView {
  const g = s.game!;
  const c = g.cells[i];
  const sel = g.selected;
  const selValue = sel !== null ? g.cells[sel].value : null;

  let conflict = false;
  if (conflicts && c.value !== null) conflict = PEERS[i].some((p) => g.cells[p].value === c.value);

  let hintFocus = false;
  let hintTarget = false;
  const h = s.activeHint;
  if (h?.kind === 'step') {
    hintTarget = h.hint.targetCells.includes(i);
    hintFocus = !hintTarget && h.hint.focusCells.includes(i);
  } else if (h?.kind === 'mistake' || h?.kind === 'badNotes') {
    hintTarget = h.index === i;
  }

  return {
    value: c.value,
    given: c.given,
    notes: c.notes,
    wrong: c.value !== null && !c.given && c.value !== g.puzzle.solution[i],
    selected: sel === i,
    tabbable: sel === null ? i === 0 : sel === i,
    peer: sel !== null && isPeer(sel, i),
    same: sameDigit && selValue !== null && sel !== i && c.value === selValue,
    conflict,
    hintFocus,
    hintTarget,
    noteDigit: sameDigit && selValue !== null && c.notes & bit(selValue) ? selValue : 0,
  };
}

function background(v: CellView): string {
  if (v.selected) return 'bg-cell-selected';
  if (v.hintTarget) return 'bg-hint-target';
  if (v.hintFocus) return 'bg-hint-focus';
  if (v.conflict) return 'bg-cell-conflict';
  if (v.same) return 'bg-cell-same';
  if (v.peer) return 'bg-cell-peer';
  return 'bg-surface';
}

function borders(i: CellIndex): string {
  const r = ROW_OF[i];
  const c = COL_OF[i];
  const out: string[] = [];
  if (c < 8) out.push(c % 3 === 2 ? 'border-e-2 border-e-line-strong' : 'border-e border-e-line');
  if (r < 8) out.push(r % 3 === 2 ? 'border-b-2 border-b-line-strong' : 'border-b border-b-line');
  return out.join(' ');
}

export const Cell = memo(function Cell({ index }: { index: CellIndex }) {
  const { t } = useTranslation();
  const conflicts = useSettings((s) => s.highlightConflicts);
  const sameDigit = useSettings((s) => s.highlightSameDigit);
  const v = useGame(useShallow((s) => cellView(s, index, conflicts, sameDigit)));
  const ref = useRef<HTMLDivElement>(null);

  // Roving focus: follow the selection while focus is inside the grid.
  useEffect(() => {
    if (v.selected && ref.current && document.activeElement?.closest('[data-board]')) ref.current.focus();
  }, [v.selected]);

  const notes = digitsOf(v.notes);
  const state =
    v.value === null
      ? notes.length
        ? t('cell.notes', { notes: notes.join(' ') })
        : t('cell.empty')
      : t(v.given ? 'cell.given' : v.wrong ? 'cell.wrong' : 'cell.value', { digit: v.value });

  const textColor = v.given ? 'text-given font-semibold' : v.wrong ? 'text-error' : 'text-entry';

  return (
    <div
      ref={ref}
      role="gridcell"
      tabIndex={v.tabbable ? 0 : -1}
      aria-selected={v.selected}
      aria-label={t('cell.label', { row: ROW_OF[index] + 1, col: COL_OF[index] + 1, state })}
      onClick={() => gameStore.getState().select(index)}
      className={`relative flex cursor-pointer select-none items-center justify-center outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${background(v)} ${borders(index)}`}
    >
      {v.value !== null ? (
        <span aria-hidden="true" className={`text-[clamp(1.1rem,6vw,2rem)] leading-none ${textColor}`}>
          {v.value}
        </span>
      ) : (
        notes.length > 0 && (
          <span aria-hidden="true" className="grid h-full w-full grid-cols-3 grid-rows-3 p-[6%]">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <span
                key={d}
                className={`flex items-center justify-center text-[clamp(0.5rem,2.2vw,0.75rem)] leading-none ${
                  d === v.noteDigit ? 'font-bold text-entry' : 'text-muted'
                }`}
              >
                {v.notes & bit(d) ? d : ''}
              </span>
            ))}
          </span>
        )
      )}
    </div>
  );
});
