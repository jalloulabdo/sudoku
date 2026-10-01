/**
 * Versioned, failure-tolerant localStorage wrapper. Every read and write is wrapped in
 * try/catch so the app keeps working (without saving) when storage is unavailable.
 */

export const STORAGE_KEYS = {
  game: 'sudoku:game',
  settings: 'sudoku:settings',
  stats: 'sudoku:stats',
} as const;

interface Envelope {
  schemaVersion: number;
  data: unknown;
}

export interface StoredValue<T> {
  /** Current schema version written by this build. */
  version: number;
  /** Upgrades data saved by older versions, keyed by the version they were saved with. */
  migrations?: Record<number, (data: unknown) => unknown>;
  /** Rejects corrupt or unexpected data; returning null discards it. */
  validate: (data: unknown) => T | null;
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // e.g. access blocked by browser privacy settings
  }
}

export function loadValue<T>(key: string, spec: StoredValue<T>): T | null {
  try {
    const raw = getStorage()?.getItem(key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Partial<Envelope>;
    if (typeof env.schemaVersion !== 'number' || !('data' in env)) return null;
    let { schemaVersion: version, data } = env as Envelope;
    if (version > spec.version) return null; // saved by a newer build; don't guess
    while (version < spec.version) {
      const migrate = spec.migrations?.[version];
      if (!migrate) return null;
      data = migrate(data);
      version++;
    }
    return spec.validate(data);
  } catch {
    return null;
  }
}

export function saveValue(key: string, version: number, data: unknown): boolean {
  try {
    const storage = getStorage();
    if (!storage) return false;
    const env: Envelope = { schemaVersion: version, data };
    storage.setItem(key, JSON.stringify(env));
    return true;
  } catch {
    return false; // quota exceeded, private mode, …
  }
}

export function removeValue(key: string): void {
  try {
    getStorage()?.removeItem(key);
  } catch {
    // ignore
  }
}

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
