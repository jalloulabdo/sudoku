export interface ClockOptions {
  now?: () => number;
  intervalMs?: number;
  /** Ignore gaps longer than this (e.g. the device slept and timers were suspended). */
  maxDeltaMs?: number;
}

/**
 * Calls `onTick` with the real time elapsed since the previous tick, measured with
 * performance.now() rather than by counting intervals. Returns a stop function.
 */
export function startClock(onTick: (deltaMs: number) => void, opts: ClockOptions = {}): () => void {
  const now = opts.now ?? (() => performance.now());
  const maxDelta = opts.maxDeltaMs ?? 1000;
  let last = now();
  const id = setInterval(() => {
    const t = now();
    const delta = t - last;
    last = t;
    if (delta > 0) onTick(Math.min(delta, maxDelta));
  }, opts.intervalMs ?? 250);
  return () => clearInterval(id);
}
