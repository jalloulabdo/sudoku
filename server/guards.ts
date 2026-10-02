import type { Db } from './db';
import type { Ctx } from './env';
import { HttpError } from './http';

/**
 * Fixed-window rate limit. Returns false once `limit` hits happened within `windowMs`.
 * One atomic upsert, so concurrent requests can't slip past the limit.
 */
export async function rateLimit(db: Db, key: string, limit: number, windowMs: number, now: number): Promise<boolean> {
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN ?2 - window_start >= ?3 THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN ?2 - window_start >= ?3 THEN ?2 ELSE window_start END
       RETURNING count`,
    )
    .bind(key, now, windowMs)
    .first<{ count: number }>();
  return (row?.count ?? 0) <= limit;
}

/** Cloudflare Turnstile check; skipped when no secret is configured (local development). */
export async function verifyTurnstile(ctx: Ctx, token: string | undefined): Promise<void> {
  const secret = ctx.env.TURNSTILE_SECRET;
  if (!secret) return;
  if (!token) throw new HttpError(400, 'captcha_required');
  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  const ip = ctx.request.headers.get('CF-Connecting-IP');
  if (ip) form.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const data = (await res.json()) as { success?: boolean };
  if (!data.success) throw new HttpError(400, 'captcha_failed');
}
