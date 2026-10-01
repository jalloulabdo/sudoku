import { useEffect } from 'react';
import { startClock } from '../store/clock';
import { gameStore } from '../store/gameStore';

/** Drives the game timer while mounted and pauses the game when the tab is hidden. */
export function useTimer(): void {
  useEffect(() => {
    const stop = startClock((delta) => gameStore.getState().tick(delta));
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') gameStore.getState().pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}
