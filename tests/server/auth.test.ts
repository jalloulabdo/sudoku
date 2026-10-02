import { LOGIN_TOKEN_TTL_MS, SESSION_TTL_MS } from '../../server/auth';
import { createApi } from './api';

const tokenFrom = (text: string) => /#token=([\w-]+)/.exec(text)![1];

describe('magic-link sign-in', () => {
  it('emails a localized link with the token in the URL fragment', async () => {
    const api = await createApi();
    const res = await api.call('POST', '/api/auth/request', { body: { email: '  Player@Example.COM ', locale: 'fr' } });
    expect(res).toMatchObject({ status: 200, data: { ok: true } });
    expect(api.mails).toHaveLength(1);
    const mail = api.mails[0];
    expect(mail.to).toBe('player@example.com');
    expect(mail.subject).toBe('Votre lien de connexion à Sudoku Master');
    expect(mail.text).toMatch(/^.*https:\/\/sudoku\.test\/fr\/auth\/verify#token=[\w-]{40,}/s);
    expect(mail.html).toContain('dir="ltr"');
  });

  it('stores only a hash of the login token', async () => {
    const api = await createApi();
    await api.call('POST', '/api/auth/request', { body: { email: 'a@b.co' } });
    const token = tokenFrom(api.mails[0].text);
    const rows = api.db.raw.exec('SELECT token_hash FROM login_tokens')[0].values.flat();
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toBe(token);
    expect(String(rows[0])).toMatch(/^[0-9a-f]{64}$/);
  });

  it('creates the account on first sign-in and sets a secure session cookie', async () => {
    const api = await createApi();
    await api.call('POST', '/api/auth/request', { body: { email: 'new@example.com', locale: 'ar' } });
    const res = await api.call('POST', '/api/auth/verify', { body: { token: tokenFrom(api.mails[0].text) } });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ isNew: true, user: { email: 'new@example.com', username: null, locale: 'ar' } });
    const cookie = res.headers.get('Set-Cookie')!;
    expect(cookie).toMatch(/^sid=[\w-]+; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000$/);

    const me = await api.call('GET', '/api/me', { cookie: /sid=[^;]+/.exec(cookie)![0] });
    expect(me.data.user.email).toBe('new@example.com');
  });

  it('signs an existing user back into the same account', async () => {
    const api = await createApi();
    const first = await api.signIn('same@example.com');
    const second = await api.signIn('SAME@example.com');
    expect(second.user.id).toBe(first.user.id);
    expect(second.isNew).toBe(true); // still no username chosen
  });

  it('a link works only once', async () => {
    const api = await createApi();
    await api.call('POST', '/api/auth/request', { body: { email: 'once@example.com' } });
    const token = tokenFrom(api.mails[0].text);
    expect((await api.call('POST', '/api/auth/verify', { body: { token } })).status).toBe(200);
    expect(await api.call('POST', '/api/auth/verify', { body: { token } })).toMatchObject({
      status: 400,
      data: { error: 'invalid_token' },
    });
  });

  it('a link expires after 15 minutes', async () => {
    const api = await createApi();
    await api.call('POST', '/api/auth/request', { body: { email: 'late@example.com' } });
    api.clock.now += LOGIN_TOKEN_TTL_MS + 1;
    const res = await api.call('POST', '/api/auth/verify', { body: { token: tokenFrom(api.mails[0].text) } });
    expect(res.data.error).toBe('invalid_token');
  });

  it('rejects malformed emails and unknown tokens', async () => {
    const api = await createApi();
    for (const email of ['', 'nope', 'a@b', 'x'.repeat(250) + '@a.co', 42]) {
      expect((await api.call('POST', '/api/auth/request', { body: { email } })).data.error).toBe('invalid_email');
    }
    expect((await api.call('POST', '/api/auth/verify', { body: { token: 'x'.repeat(43) } })).data.error).toBe('invalid_token');
    expect(api.mails).toHaveLength(0);
  });

  it('rate-limits sign-in emails per address and per IP', async () => {
    const api = await createApi();
    const ask = (email: string, ip = '1.1.1.1') => api.call('POST', '/api/auth/request', { body: { email }, ip });
    for (let i = 0; i < 5; i++) expect((await ask('spam@example.com')).status).toBe(200);
    expect((await ask('spam@example.com')).data.error).toBe('rate_limited');
    api.clock.now += 60 * 60 * 1000; // a new window
    expect((await ask('spam@example.com')).status).toBe(200);

    for (let i = 0; i < 20; i++) await ask(`user${i}@example.com`, '9.9.9.9');
    expect((await ask('fresh@example.com', '9.9.9.9')).data.error).toBe('rate_limited');
  });

  it('logout ends the session', async () => {
    const api = await createApi();
    const { cookie } = await api.signIn();
    const out = await api.call('POST', '/api/auth/logout', { cookie });
    expect(out.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect((await api.call('GET', '/api/me', { cookie })).status).toBe(401);
  });

  it('sessions expire after 30 days', async () => {
    const api = await createApi();
    const { cookie } = await api.signIn();
    api.clock.now += SESSION_TTL_MS + 1;
    expect((await api.call('GET', '/api/me', { cookie })).status).toBe(401);
  });
});

describe('request protection', () => {
  it('rejects state-changing requests from other origins or without an Origin', async () => {
    const api = await createApi();
    const evil = await api.call('POST', '/api/auth/request', { body: { email: 'a@b.co' }, origin: 'https://evil.example' });
    expect(evil).toMatchObject({ status: 403, data: { error: 'bad_origin' } });
    const none = await api.call('POST', '/api/auth/request', { body: { email: 'a@b.co' }, origin: null });
    expect(none.status).toBe(403);
    expect(api.mails).toHaveLength(0);
  });

  it('requires JSON bodies', async () => {
    const api = await createApi();
    const res = await handleForm(api);
    expect(res.status).toBe(415);
  });

  it('unknown routes and methods', async () => {
    const api = await createApi();
    expect((await api.call('GET', '/api/nope')).status).toBe(404);
    expect((await api.call('PUT', '/api/me', { body: {} })).status).toBe(405);
  });

  it('checks Cloudflare Turnstile when a secret is configured', async () => {
    const api = await createApi({ TURNSTILE_SECRET: 'secret' });
    expect((await api.call('POST', '/api/auth/request', { body: { email: 'a@b.co' } })).data.error).toBe('captcha_required');

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: false })));
    vi.stubGlobal('fetch', fetchMock);
    const bad = await api.call('POST', '/api/auth/request', { body: { email: 'a@b.co', turnstileToken: 'tok' }, ip: '2.2.2.2' });
    expect(bad.data.error).toBe('captcha_failed');
    const form = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData;
    expect([form.get('secret'), form.get('response'), form.get('remoteip')]).toEqual(['secret', 'tok', '2.2.2.2']);

    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ success: true })));
    const ok = await api.call('POST', '/api/auth/request', { body: { email: 'a@b.co', turnstileToken: 'tok' } });
    expect(ok.status).toBe(200);
    vi.unstubAllGlobals();
  });
});

async function handleForm(api: Awaited<ReturnType<typeof createApi>>) {
  const { handleApi } = await import('../../server/router');
  return handleApi(
    new Request('https://sudoku.test/api/auth/request', {
      method: 'POST',
      headers: { Origin: 'https://sudoku.test', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'email=a@b.co',
    }),
    api.env,
    { mail: async () => {} },
  );
}
