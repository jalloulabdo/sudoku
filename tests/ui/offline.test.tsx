// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { routes } from '../../src/App';
import { OFFLINE_READY_MS } from '../../src/components/UpdateToast';
import '../../src/i18n';
import { swMock } from '../mocks/pwa-register';
import { resetStores } from '../store/helpers';

/** Renders and waits for the layout: routes such as the home page load lazily. */
const renderAt = async (path: string) => {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
  await screen.findByRole('banner');
};
const goOffline = () => act(() => void window.dispatchEvent(new Event('offline')));
const banner = () => screen.queryByText("You're offline. Everything still works.");
const goOnline = () => act(() => void window.dispatchEvent(new Event('online')));

beforeEach(() => {
  resetStores();
  swMock.initialNeedRefresh = false;
  swMock.initialOfflineReady = false;
  swMock.updateServiceWorker.mockClear();
});
afterEach(cleanup);

describe('offline banner', () => {
  it('appears offline, hides online, and can be dismissed', async () => {
    await renderAt('/en');
    expect(banner()).toBeNull();
    goOffline();
    expect(banner()).toBeTruthy();
    goOnline();
    expect(banner()).toBeNull();

    goOffline();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(banner()).toBeNull();
    // Shows again the next time the connection drops.
    goOnline();
    goOffline();
    expect(banner()).toBeTruthy();
  });

  it('is translated', async () => {
    await renderAt('/ar');
    goOffline();
    expect(screen.getByText('أنت غير متصل بالإنترنت. كل شيء يعمل كالمعتاد.')).toBeTruthy();
  });
});

describe('update toast', () => {
  it('asks before reloading for a new version', async () => {
    swMock.initialNeedRefresh = true;
    await renderAt('/fr');
    expect(await screen.findByText('Une nouvelle version est disponible.')).toBeTruthy();
    expect(swMock.updateServiceWorker).not.toHaveBeenCalled(); // no automatic reload
    fireEvent.click(screen.getByRole('button', { name: 'Recharger' }));
    expect(swMock.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('"Later" dismisses without updating', async () => {
    swMock.initialNeedRefresh = true;
    await renderAt('/en');
    fireEvent.click(await screen.findByRole('button', { name: 'Later' }));
    expect(swMock.updateServiceWorker).not.toHaveBeenCalled();
  });

  it('confirms when the app is ready offline, then hides on its own', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] }); // keep rAF real for exit animations
    swMock.initialOfflineReady = true;
    await renderAt('/en');
    expect(await screen.findByText('Ready to play offline.')).toBeTruthy();
    act(() => void vi.advanceTimersByTime(OFFLINE_READY_MS));
    vi.useRealTimers();
    await waitFor(() => expect(screen.queryByText('Ready to play offline.')).toBeNull());
  });

  it('the update prompt does not hide on its own', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] }); // keep rAF real for exit animations
    swMock.initialNeedRefresh = true;
    await renderAt('/en');
    await screen.findByText('A new version is available.');
    act(() => void vi.advanceTimersByTime(OFFLINE_READY_MS * 3));
    vi.useRealTimers();
    expect(screen.getByText('A new version is available.')).toBeTruthy();
  });
});
