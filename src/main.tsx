import { StrictMode, startTransition } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { routes } from './App';
import { applyLocale } from './i18n';
import { isLocale } from './i18n/locales';
import { accountStore } from './store/accountStore';
import { initPersistence } from './store/persistence';
import { prefetchSlowDifficulties } from './store/puzzleSource';
import { initScoreSync } from './store/scoreSync';
import './index.css';

initPersistence();

// Start in the URL's language so the first render is already translated.
const first = window.location.pathname.split('/')[1];
if (isLocale(first)) applyLocale(first);

const router = createBrowserRouter(routes);

// The page arrives prerendered. The client render replaces it rather than hydrating, because
// it includes this browser's saved state (game, settings). Wait for lazy route chunks first so
// the prerendered content is never swapped for an empty screen.
const ready = router.state.initialized
  ? Promise.resolve()
  : new Promise<void>((resolve) => {
      const unsubscribe = router.subscribe((state) => {
        if (state.initialized) {
          unsubscribe();
          resolve();
        }
      });
    });

void ready.then(() => {
  const root = createRoot(document.getElementById('root')!);
  // A transition lets React render in small slices instead of one long task. The prerendered
  // page stays on screen until the client render is ready, so nothing visibly changes meanwhile.
  startTransition(() =>
    root.render(
      <StrictMode>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </StrictMode>,
    ),
  );
  prefetchSlowDifficulties();
  // Check the session before syncing scores, so a game started right away can be ranked.
  void accountStore.getState().refresh().finally(initScoreSync);
});
