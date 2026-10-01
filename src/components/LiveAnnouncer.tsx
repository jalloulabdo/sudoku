import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cellRef } from '../logic/board';
import { gameStore } from '../store/gameStore';
import { settingsStore } from '../store/settingsStore';

/** Screen-reader announcements for placements, mistakes and the end of a game. */
export function LiveAnnouncer() {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');

  useEffect(
    () =>
      gameStore.subscribe((state, prev) => {
        const g = state.game;
        const p = prev.game;
        if (!g || !p || g.puzzle.id !== p.puzzle.id) return;
        if (g.status !== p.status && g.status === 'won') setMessage(t('announce.won'));
        else if (g.status !== p.status && g.status === 'lost') setMessage(t('announce.lost'));
        else if (g.mistakes > p.mistakes) {
          const max = settingsStore.getState().mistakeLimit;
          setMessage(t('announce.mistake', { value: g.mistakes, max: max ?? '∞' }));
        } else if (g.history.length > p.history.length) {
          const move = g.history[g.history.length - 1];
          if (move.type === 'place') setMessage(t('announce.placed', { digit: move.next.value, cell: cellRef(move.index) }));
        }
      }),
    [t],
  );

  return (
    <div aria-live="assertive" className="sr-only">
      {message}
    </div>
  );
}
