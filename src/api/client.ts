/** Error from the API: `code` is the server's error code, or 'network' when the request never got an answer. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

/** Same-origin JSON request to /api (the session cookie is sent automatically). */
export async function api<T>(path: string, { method = 'GET', body }: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'unknown');
  return data as T;
}

/** Translation key for an API error, falling back to a generic message. */
export function errorKey(err: unknown, known: readonly string[]): string {
  const code = err instanceof ApiError ? err.code : 'unknown';
  return `account.errors.${known.includes(code) || code === 'network' ? code : 'unknown'}`;
}
