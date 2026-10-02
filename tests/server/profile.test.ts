import { createApi } from './api';

describe('profile', () => {
  it('requires a session', async () => {
    const api = await createApi();
    expect(await api.call('GET', '/api/me')).toMatchObject({ status: 401, data: { error: 'unauthenticated' } });
    expect((await api.call('PATCH', '/api/me', { body: { username: 'abc' } })).status).toBe(401);
  });

  it('sets a username, in any script', async () => {
    const api = await createApi();
    const { cookie } = await api.signIn();
    for (const username of ['Sudoku_Fan', 'joueur.42', 'لاعب_سودوكو', 'Ünïcödé-9']) {
      const res = await api.call('PATCH', '/api/me', { cookie, body: { username } });
      expect(res.status, username).toBe(200);
      expect(res.data.user.username).toBe(username);
    }
  });

  it('rejects invalid usernames', async () => {
    const api = await createApi();
    const { cookie } = await api.signIn();
    for (const username of ['ab', 'x'.repeat(21), 'has space', 'semi;colon', '<script>', 42]) {
      expect((await api.call('PATCH', '/api/me', { cookie, body: { username } })).data.error, String(username)).toBe('invalid_username');
    }
  });

  it('usernames are unique, ignoring case', async () => {
    const api = await createApi();
    const a = await api.signIn('a@example.com');
    const b = await api.signIn('b@example.com');
    expect((await api.call('PATCH', '/api/me', { cookie: a.cookie, body: { username: 'Champion' } })).status).toBe(200);
    expect(await api.call('PATCH', '/api/me', { cookie: b.cookie, body: { username: 'champion' } })).toMatchObject({
      status: 409,
      data: { error: 'username_taken' },
    });
    // Re-saving your own name is fine.
    expect((await api.call('PATCH', '/api/me', { cookie: a.cookie, body: { username: 'CHAMPION' } })).status).toBe(200);
  });

  it('updates the email language', async () => {
    const api = await createApi();
    const { cookie } = await api.signIn();
    expect((await api.call('PATCH', '/api/me', { cookie, body: { locale: 'ar' } })).data.user.locale).toBe('ar');
    expect((await api.call('PATCH', '/api/me', { cookie, body: { locale: 'de' } })).data.error).toBe('invalid_locale');
  });

  it('deleting the account removes the user and signs out everywhere', async () => {
    const api = await createApi();
    const one = await api.signIn('gone@example.com');
    const two = await api.signIn('gone@example.com'); // a second device
    expect((await api.call('DELETE', '/api/me', { cookie: one.cookie })).status).toBe(200);
    expect((await api.call('GET', '/api/me', { cookie: two.cookie })).status).toBe(401);
    expect(api.db.raw.exec("SELECT count(*) FROM users")[0].values[0][0]).toBe(0);
    expect(api.db.raw.exec("SELECT count(*) FROM sessions")[0].values[0][0]).toBe(0);
  });
});
