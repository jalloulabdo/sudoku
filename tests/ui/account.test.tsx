// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { routes } from '../../src/App';
import '../../src/i18n';
import { accountStore, type PublicUser } from '../../src/store/accountStore';
import { resetStores } from '../store/helpers';

const USER: PublicUser = { id: 'u1', email: 'player@example.com', username: null, locale: 'en', createdAt: Date.UTC(2026, 9, 1) };

type Reply = { status?: number; body: unknown };
let replies: Record<string, Reply | ((init: RequestInit) => Reply)>;
const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const key = `${init.method ?? 'GET'} ${String(input)}`;
  const r = replies[key];
  if (!r) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 });
  const { status = 200, body } = typeof r === 'function' ? r(init) : r;
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
});
const bodyOf = (call: number) => JSON.parse(String((fetchMock.mock.calls[call][1] as RequestInit).body));

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  resetStores();
  accountStore.setState({ status: 'signedOut', user: null });
  replies = {};
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('sign in', () => {
  it('sends a magic link in the page language and confirms', async () => {
    replies['POST /api/auth/request'] = { body: { ok: true } };
    renderAt('/fr/login');
    fireEvent.change(await screen.findByLabelText('Adresse e-mail'), { target: { value: 'joueur@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le lien de connexion' }));
    expect(await screen.findByRole('heading', { name: 'Consultez votre boîte de réception' })).toBeTruthy();
    expect(screen.getByText(/joueur@example\.com/)).toBeTruthy();
    expect(bodyOf(0)).toMatchObject({ email: 'joueur@example.com', locale: 'fr' });
  });

  it('shows translated server errors', async () => {
    replies['POST /api/auth/request'] = { status: 429, body: { error: 'rate_limited' } };
    renderAt('/en/login');
    fireEvent.change(await screen.findByLabelText('Email address'), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in link' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Too many attempts. Please wait a while and try again.');
  });

  it('the email link signs in and opens the profile', async () => {
    replies['POST /api/auth/verify'] = { body: { user: USER, isNew: true } };
    window.history.replaceState(null, '', '/en/auth/verify#token=abcdefghijklmnopqrstuvwxyz');
    const router = renderAt('/en/auth/verify');
    await waitFor(() => expect(router.state.location.pathname).toBe('/en/profile'));
    expect(bodyOf(0)).toEqual({ token: 'abcdefghijklmnopqrstuvwxyz' });
    expect(fetchMock).toHaveBeenCalledTimes(1); // single-use token sent once, even under StrictMode
    expect(window.location.hash).toBe(''); // token removed from the address bar
    expect(accountStore.getState()).toMatchObject({ status: 'signedIn', user: USER });
    expect(await screen.findByText('Choose a username to appear on leaderboards and so your friends can find you.')).toBeTruthy();
  });

  it('an expired link explains and offers a new one', async () => {
    replies['POST /api/auth/verify'] = { status: 400, body: { error: 'invalid_token' } };
    window.history.replaceState(null, '', '/ar/auth/verify#token=abcdefghijklmnopqrstuvwxyz');
    renderAt('/ar/auth/verify');
    expect(await screen.findByRole('heading', { name: 'رابط تسجيل الدخول هذا غير صالح أو انتهت صلاحيته.' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'طلب رابط جديد' }).getAttribute('href')).toBe('/ar/login');
  });
});

describe('profile', () => {
  it('requires signing in', async () => {
    const router = renderAt('/en/profile');
    await waitFor(() => expect(router.state.location.pathname).toBe('/en/login'));
  });

  it('saves a username and shows conflicts', async () => {
    accountStore.getState().setUser(USER);
    let calls = 0;
    replies['PATCH /api/me'] = (init) => {
      const { username } = JSON.parse(String(init.body));
      return ++calls === 1
        ? { status: 409, body: { error: 'username_taken' } }
        : { body: { user: { ...USER, username } } };
    };
    renderAt('/en/profile');
    const input = await screen.findByLabelText('Username');
    fireEvent.change(input, { target: { value: 'Champion' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('This username is already taken.')).toBeTruthy();

    fireEvent.change(input, { target: { value: 'Champion2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect(accountStore.getState().user?.username).toBe('Champion2');
    expect(screen.getByRole('heading', { level: 1, name: 'Champion2' })).toBeTruthy();
  });

  it('signing out clears the account and goes home', async () => {
    accountStore.getState().setUser({ ...USER, username: 'Champion' });
    replies['POST /api/auth/logout'] = { body: { ok: true } };
    const router = renderAt('/en/profile');
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/en'));
    expect(accountStore.getState().status).toBe('signedOut');
  });
});

describe('header', () => {
  it('links to sign-in, or to the profile with the username', async () => {
    renderAt('/en');
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/en/login');
    cleanup();
    accountStore.getState().setUser({ ...USER, username: 'Champion' });
    renderAt('/en');
    expect(screen.getByRole('link', { name: 'Champion' }).getAttribute('href')).toBe('/en/profile');
  });
});

describe('account store', () => {
  it('keeps the saved account when offline, signs out on 401', async () => {
    accountStore.getState().setUser({ ...USER, username: 'Champion' });
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError('offline');
    });
    await accountStore.getState().refresh();
    expect(accountStore.getState()).toMatchObject({ status: 'signedIn', user: { username: 'Champion' } });

    await accountStore.getState().refresh(); // no reply registered → 401
    expect(accountStore.getState()).toMatchObject({ status: 'signedOut', user: null });
  });
});
