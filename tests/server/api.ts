import type { Env } from '../../server/env';
import { handleApi } from '../../server/router';
import { createTestDb } from './testDb';

export const ORIGIN = 'https://sudoku.test';

export interface SentMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** A test client for the API: real router and handlers, in-memory database, recorded emails. */
export async function createApi(envOverrides: Partial<Env> = {}) {
  const db = await createTestDb();
  const env: Env = { DB: db, APP_ENV: 'test', ...envOverrides };
  const mails: SentMail[] = [];
  const clock = { now: 1_800_000_000_000 };

  async function call(
    method: string,
    path: string,
    opts: { body?: unknown; cookie?: string; origin?: string | null; ip?: string } = {},
  ) {
    const headers = new Headers();
    if (opts.body !== undefined) headers.set('Content-Type', 'application/json');
    if (opts.cookie) headers.set('Cookie', opts.cookie);
    if (opts.origin !== null) headers.set('Origin', opts.origin ?? ORIGIN);
    if (opts.ip) headers.set('CF-Connecting-IP', opts.ip);
    const res = await handleApi(
      new Request(ORIGIN + path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }),
      env,
      { now: clock.now, mail: async (m) => void mails.push(m) },
    );
    const data = res.headers.get('Content-Type')?.includes('json') ? await res.json() : null;
    return { status: res.status, data: data as any, headers: res.headers };
  }

  /** Signs in through the real magic-link flow and returns the session cookie. */
  async function signIn(email = 'player@example.com', locale = 'en') {
    await call('POST', '/api/auth/request', { body: { email, locale } });
    const token = /#token=([\w-]+)/.exec(mails.at(-1)!.text)![1];
    const res = await call('POST', '/api/auth/verify', { body: { token } });
    const cookie = /sid=[^;]+/.exec(res.headers.get('Set-Cookie') ?? '')![0];
    return { cookie, user: res.data.user, isNew: res.data.isNew };
  }

  return { db, env, mails, clock, call, signIn };
}
