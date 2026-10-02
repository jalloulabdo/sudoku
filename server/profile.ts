import { isLocale } from '../src/i18n/locales';
import { publicUser, requireUser } from './auth';
import type { Ctx } from './env';
import { HttpError, json, readJson, sessionCookie } from './http';

/** Letters (any script), digits, _ . - ; 3 to 20 characters. */
export const USERNAME_PATTERN = /^[\p{L}\p{N}_.-]{3,20}$/u;

/** GET /api/me */
export async function getMe(ctx: Ctx): Promise<Response> {
  return json({ user: publicUser(await requireUser(ctx)) });
}

/** PATCH /api/me — { username?, locale? } */
export async function updateMe(ctx: Ctx): Promise<Response> {
  const user = await requireUser(ctx);
  const body = await readJson<{ username?: unknown; locale?: unknown }>(ctx.request);
  const db = ctx.env.DB;

  if (body.username !== undefined) {
    const username = typeof body.username === 'string' ? body.username.trim().normalize('NFC') : '';
    if (!USERNAME_PATTERN.test(username)) throw new HttpError(400, 'invalid_username');
    const taken = await db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').bind(username, user.id).first();
    if (taken) throw new HttpError(409, 'username_taken');
    await db.prepare('UPDATE users SET username = ? WHERE id = ?').bind(username, user.id).run();
    user.username = username;
  }
  if (body.locale !== undefined) {
    if (!isLocale(body.locale)) throw new HttpError(400, 'invalid_locale');
    await db.prepare('UPDATE users SET locale = ? WHERE id = ?').bind(body.locale, user.id).run();
    user.locale = body.locale;
  }
  return json({ user: publicUser(user) });
}

/** DELETE /api/me — deletes the account and everything attached to it. */
export async function deleteMe(ctx: Ctx): Promise<Response> {
  const user = await requireUser(ctx);
  const db = ctx.env.DB;
  await db.batch([
    db.prepare('DELETE FROM scores WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM game_tickets WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM login_tokens WHERE email = ?').bind(user.email),
    db.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);
  return json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie('', 0) } });
}
