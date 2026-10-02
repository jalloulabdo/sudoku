import { ApiError, api } from '../api/client';
import { gridToString } from '../logic/points';
import type { GameState, Puzzle } from '../logic/types';
import { isObject, loadValue, saveValue } from '../storage/storage';
import { accountStore } from './accountStore';
import { gameStore } from './gameStore';
import { uiStore, type ScoreState } from './uiStore';

/** Finished ranked games not yet accepted by the server (e.g. solved offline). */
export interface PendingScore {
  ticketId: string;
  puzzleId: string;
  solution: string;
  elapsedMs: number;
  mistakes: number;
  hints: number;
}

const PENDING_KEY = 'sudoku:pendingScores';
const PENDING_VERSION = 1;
/** A ticket is only requested for a game that has really just started. */
const FRESH_GAME_MS = 5000;

const loadPending = (): PendingScore[] =>
  loadValue(PENDING_KEY, {
    version: PENDING_VERSION,
    validate: (d) => (Array.isArray(d) ? (d.filter((p) => isObject(p) && typeof p.ticketId === 'string') as PendingScore[]) : null),
  }) ?? [];
const savePending = (list: PendingScore[]) => saveValue(PENDING_KEY, PENDING_VERSION, list);

const setScore = (score: ScoreState) => uiStore.setState({ score });
const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

async function requestTicket(puzzle: Puzzle): Promise<void> {
  if (accountStore.getState().status !== 'signedIn') return setScore({ puzzleId: puzzle.id, state: 'unranked', reason: 'signedOut' });
  if (!isOnline()) return setScore({ puzzleId: puzzle.id, state: 'unranked', reason: 'offline' });
  try {
    const { ticketId } = await api<{ ticketId: string }>('/api/games/start', {
      method: 'POST',
      body: { puzzleId: puzzle.id, difficulty: puzzle.difficulty, givens: gridToString(puzzle.givens) },
    });
    gameStore.getState().setTicket(puzzle.id, ticketId);
  } catch (err) {
    const reason = err instanceof ApiError && err.code === 'already_scored' ? 'alreadyScored' : err instanceof ApiError && err.code === 'network' ? 'offline' : 'error';
    setScore({ puzzleId: puzzle.id, state: 'unranked', reason });
  }
}

async function sendPending(): Promise<void> {
  let pending = loadPending();
  for (const item of [...pending]) {
    try {
      const result = await api<{ points: number; base: number; timeBonus: number; penalty: number; dailyRank: number | null }>(
        '/api/games/finish',
        { method: 'POST', body: { ticketId: item.ticketId, solution: item.solution, elapsedMs: item.elapsedMs, mistakes: item.mistakes, hints: item.hints } },
      );
      setScore({ puzzleId: item.puzzleId, state: 'scored', ...result });
    } catch (err) {
      const retryLater = err instanceof ApiError && (err.code === 'network' || err.status >= 500);
      if (retryLater) {
        setScore({ puzzleId: item.puzzleId, state: 'queued' });
        break;
      }
      setScore({ puzzleId: item.puzzleId, state: 'rejected', code: err instanceof ApiError ? err.code : 'unknown' });
    }
    pending = pending.filter((p) => p.ticketId !== item.ticketId);
    savePending(pending);
  }
}

let flushing: Promise<void> | null = null;

/** Sends queued results, one flush at a time. Network failures keep them queued; rejected ones are dropped. */
export function flushPendingScores(): Promise<void> {
  if (flushing) return flushing;
  // Clear the flag in .finally(), after the assignment: an empty queue finishes synchronously.
  flushing = sendPending().finally(() => {
    flushing = null;
  });
  return flushing;
}

function onWin(g: GameState): void {
  if (!g.ticketId) return;
  const pending = loadPending().filter((p) => p.ticketId !== g.ticketId);
  pending.push({
    ticketId: g.ticketId,
    puzzleId: g.puzzle.id,
    solution: gridToString(g.cells.map((c) => c.value)),
    elapsedMs: Math.round(g.elapsedMs),
    mistakes: g.mistakes,
    hints: g.hintsUsed,
  });
  savePending(pending);
  setScore({ puzzleId: g.puzzle.id, state: isOnline() ? 'submitting' : 'queued' });
  void flushPendingScores();
}

const isFresh = (g: GameState) => g.status === 'playing' && !g.ticketId && g.history.length === 0 && g.elapsedMs < FRESH_GAME_MS;

/** Ranked play: a ticket when a game starts, the result when it is won. Returns a cleanup function. */
export function initScoreSync(): () => void {
  // A game may have started before this ran (pages start one right away).
  const current = gameStore.getState().game;
  if (current && isFresh(current)) void requestTicket(current.puzzle);

  const unsubscribe = gameStore.subscribe((state, prev) => {
    const g = state.game;
    const p = prev.game;
    if (!g) return;
    const isNewGame = g.puzzle.id !== p?.puzzle.id;
    if (isNewGame) {
      uiStore.setState({ score: null });
      if (isFresh(g)) void requestTicket(g.puzzle);
    }
    if (g.status === 'won' && p?.status !== 'won' && !isNewGame) onWin(g);
  });
  const onOnline = () => void flushPendingScores();
  window.addEventListener('online', onOnline);
  void flushPendingScores();
  return () => {
    unsubscribe();
    window.removeEventListener('online', onOnline);
  };
}
