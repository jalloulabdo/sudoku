import { useEffect } from 'react';
import { COL_OF, ROW_OF } from '../logic/board';
import type { Digit } from '../logic/types';
import { gameStore } from '../store/gameStore';

const MOVES: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1], // the grid is always LTR, so Left is always visually left
  ArrowRight: [0, 1],
};

/** Reads the digit from `key`, falling back to the physical key (AZERTY needs Shift for digits). */
function digitOf(e: KeyboardEvent): Digit | null {
  if (/^[1-9]$/.test(e.key)) return Number(e.key) as Digit;
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  return m ? (Number(m[1]) as Digit) : null;
}

export function handleGameKey(e: KeyboardEvent): void {
  if (e.defaultPrevented) return;
  if (document.querySelector('[role="dialog"]')) return; // modals own the keyboard
  const target = e.target as HTMLElement | null;
  if (target?.closest?.('input, select, textarea, [contenteditable="true"]')) return;

  const s = gameStore.getState();
  const g = s.game;
  if (!g) return;
  const mod = e.ctrlKey || e.metaKey;
  const handled = () => e.preventDefault();

  if (mod && (e.key.toLowerCase() === 'z' || e.code === 'KeyZ')) {
    if (e.shiftKey) s.redo();
    else s.undo();
    return handled();
  }
  if (mod && (e.key.toLowerCase() === 'y' || e.code === 'KeyY')) {
    s.redo();
    return handled();
  }
  if (mod || e.altKey) return;

  if (e.key === ' ' || e.code === 'Space') {
    if (g.status === 'paused') s.resume();
    else s.pause();
    return handled();
  }

  const move = MOVES[e.key];
  if (move) {
    const from = g.selected ?? 40;
    const r = Math.min(8, Math.max(0, ROW_OF[from] + move[0]));
    const c = Math.min(8, Math.max(0, COL_OF[from] + move[1]));
    s.select(g.selected === null ? 40 : r * 9 + c);
    return handled();
  }

  const digit = digitOf(e);
  if (digit) {
    s.input(digit);
    return handled();
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    s.erase();
    return handled();
  }
  if (e.key.toLowerCase() === 'n' || e.code === 'KeyN') {
    s.toggleNotesMode();
    return handled();
  }
}

/** Keyboard play: arrows, 1–9, Backspace/Delete, N, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y, Space. */
export function useKeyboardControls(): void {
  useEffect(() => {
    window.addEventListener('keydown', handleGameKey);
    return () => window.removeEventListener('keydown', handleGameKey);
  }, []);
}
