// Test stand-in for `virtual:pwa-register/react` (provided by vite-plugin-pwa at build time).
import { useState } from 'react';

export const swMock = {
  initialNeedRefresh: false,
  initialOfflineReady: false,
  updateServiceWorker: vi.fn(async (_reload?: boolean) => {}),
};

export function useRegisterSW() {
  const needRefresh = useState(swMock.initialNeedRefresh);
  const offlineReady = useState(swMock.initialOfflineReady);
  return { needRefresh, offlineReady, updateServiceWorker: swMock.updateServiceWorker };
}
