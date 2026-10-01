import { generatePuzzle } from './generator';
import type { GenerateRequest, GenerateResponse } from './generator.worker';
import { randomSeed } from './prng';
import type { Difficulty, Puzzle } from './types';

/**
 * 'foreground' serves puzzles the player is waiting for; 'background' pre-generates slow
 * ones (Master) on a separate worker so it never delays a foreground request.
 */
export type Lane = 'foreground' | 'background';

interface Pending {
  lane: Lane;
  resolve: (p: Puzzle) => void;
  reject: (e: Error) => void;
}

const workers: Partial<Record<Lane, Worker>> = {};
const pending = new Map<number, Pending>();
let nextRequestId = 1;

function getWorker(lane: Lane): Worker | null {
  if (typeof Worker === 'undefined') return null;
  let worker = workers[lane];
  if (!worker) {
    worker = new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<GenerateResponse>) => {
      const res = event.data;
      const entry = pending.get(res.requestId);
      if (!entry) return;
      pending.delete(res.requestId);
      if (res.ok) entry.resolve(res.puzzle);
      else entry.reject(new Error(res.error));
    };
    worker.onerror = (event) => {
      // Fail everything sent to this worker; a fresh one is created on the next request.
      const error = new Error(event.message || 'Puzzle generator worker failed');
      for (const [id, entry] of pending) {
        if (entry.lane !== lane) continue;
        entry.reject(error);
        pending.delete(id);
      }
      workers[lane]?.terminate();
      delete workers[lane];
    };
    workers[lane] = worker;
  }
  return worker;
}

/** Generates off the main thread; falls back to the main thread where workers are unavailable. */
export function generatePuzzleAsync(
  difficulty: Difficulty,
  seed = randomSeed(),
  id?: string,
  lane: Lane = 'foreground',
): Promise<Puzzle> {
  const w = getWorker(lane);
  if (!w) return Promise.resolve().then(() => generatePuzzle(difficulty, seed, id));
  const requestId = nextRequestId++;
  return new Promise<Puzzle>((resolve, reject) => {
    pending.set(requestId, { lane, resolve, reject });
    const request: GenerateRequest = { requestId, difficulty, seed, id };
    w.postMessage(request);
  });
}
