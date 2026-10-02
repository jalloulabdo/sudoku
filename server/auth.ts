import { DEFAULT_LOCALE, isLocale } from '../src/i18n/locales';
import { randomToken, sha256 } from './crypto';
import { loginEmail } from './emails';
import type { Ctx } from './env';
import { rateLimit, verifyTurnstile } from './guards';
import { HttpError, getCookie, json, readJson, sessionCookie } from './http';

export const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const LIMITS = { perEmail: 5, perIp: 20 };

export interface UserRow {
  id: string;
  email: string;
  username: string | null;
  locale: string;
  created_at: number;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string | null;
  locale: string;
  createdAt: number;
}

export const publicUser = (u: UserRow): PublicUser => ({
  id: u.id,
  email: u.email,
  username: u.username,
  locale: u.locale,
  createdAt: u.created_at,
});

function normalizeEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'invalid_email');
  return email;
}

/** POST /api/auth/request — emails a single-use sign-in link. Same answer whether or not the account exists. */
export async function requestLink(ctx: Ctx): Promise<Response> {
  const body = await readJson<{ email?: unknown; locale?: unknown; turnstileToken?: string }>(ctx.request);
  const email = normalizeEmail(body.email);
  const locale = isLocale(body.locale) ? body.locale : DEFAULT_LOCALE;
  await verifyTurnstile(ctx, body.turnstileToken);

  const ip = ctx.request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const db = ctx.env.DB;
  const allowed =
    (await rateLimit(db, `login:email:${email}`, LIMITS.perEmail, HOUR, ctx.now)) &&
    (await rateLimit(db, `login:ip:${ip}`, LIMITS.perIp, HOUR, ctx.now));
  if (!allowed) throw new HttpError(429, 'rate_limited');

  const token = randomToken();
  await db
    .prepare('INSERT INTO login_tokens (token_hash, email, locale, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256(token), email, locale, ctx.now, ctx.now + LOGIN_TOKEN_TTL_MS)
    .run();

  // The token travels in the fragment: it never reaches server logs or Referer headers, and
  // link scanners that only fetch the URL can't use it up.
  const link = `${ctx.url.origin}/${locale}/auth/verify#token=${token}`;
  await ctx.mail(loginEmail(locale, email, link));
  return json({ ok: true });
}

/** POST /api/auth/verify — exchanges a sign-in token for a session cookie, creating the account on first use. */
export async function verifyLink(ctx: Ctx): Promise<Response> {
  const { token } = await readJson<{ token?: unknown }>(ctx.request);
  if (typeof token !== 'string' || token.length < 20) throw new HttpError(400, 'invalid_token');
  const db = ctx.env.DB;
  const hash = await sha256(token);

  // Claim the token atomically: a second use, or an expired token, changes no row.
  const claim = await db
    .prepare('UPDATE login_tokens SET used_at = ?1 WHERE token_hash = ?2 AND used_at IS NULL AND expires_at > ?1')
    .bind(ctx.now, hash)
    .run();
  if (claim.meta.changes !== 1) throw new HttpError(400, 'invalid_token');
  const login = (await db.prepare('SELECT email, locale FROM login_tokens WHERE token_hash = ?').bind(hash).first<{
    email: string;
    locale: string;
  }>())!;

  let user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(login.email).first<UserRow>();
  if (!user) {
    user = { id: randomToken(12), email: login.email, username: null, locale: login.locale, created_at: ctx.now };
    await db
      .prepare('INSERT INTO users (id, email, username, locale, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(user.id, user.email, null, user.locale, user.created_at)
      .run();
  }

  const session = randomToken();
  await db
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(session), user.id, ctx.now, ctx.now + SESSION_TTL_MS)
    .run();
  return json(
    { user: publicUser(user), isNew: user.username === null },
    { headers: { 'Set-Cookie': sessionCookie(session, SESSION_TTL_MS / 1000) } },
  );
}

/** The signed-in user, or null. */
export async function currentUser(ctx: Ctx): Promise<UserRow | null> {
  const sid = getCookie(ctx.request, 'sid');
  if (!sid) return null;
  return ctx.env.DB.prepare(
    'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?',
  )
    .bind(await sha256(sid), ctx.now)
    .first<UserRow>();
}

export async function requireUser(ctx: Ctx): Promise<UserRow> {
  const user = await currentUser(ctx);
  if (!user) throw new HttpError(401, 'unauthenticated');
  return user;
}

/** POST /api/auth/logout */
export async function logout(ctx: Ctx): Promise<Response> {
  const sid = getCookie(ctx.request, 'sid');
  if (sid) await ctx.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(sid)).run();
  return json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie('', 0) } });
}
