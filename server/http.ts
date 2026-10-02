export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return json({ error: err.code }, { status: err.status });
  console.error(err);
  return json({ error: 'internal' }, { status: 500 });
}

/** Parses a JSON body, rejecting other content types (part of the CSRF defence). */
export async function readJson<T>(request: Request): Promise<T> {
  if (!request.headers.get('Content-Type')?.includes('application/json')) throw new HttpError(415, 'json_required');
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

/** State-changing requests must come from our own pages. */
export function assertSameOrigin(request: Request, url: URL): void {
  if (request.method === 'GET' || request.method === 'HEAD') return;
  const origin = request.headers.get('Origin');
  if (origin !== url.origin) throw new HttpError(403, 'bad_origin');
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function sessionCookie(value: string, maxAgeSeconds: number): string {
  return `sid=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}
