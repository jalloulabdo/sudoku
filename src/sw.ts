/// <reference lib="webworker" />
// Service worker (built by vite-plugin-pwa in injectManifest mode).
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | PrecacheEntry)[] };

// Prompt-to-update: a new worker waits until the player presses "Reload" in UpdateToast.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// Every built file, including each prerendered page. Pages are cached under their real file
// name (fr/daily.html), so caching never depends on how the host handles clean URLs, and both
// /fr/daily and /fr/daily/ are answered from that entry.
precacheAndRoute(self.__WB_MANIFEST, {
  urlManipulation: ({ url }) => [new URL(`${url.pathname.replace(/\/$/, '')}.html`, url)],
});
cleanupOutdatedCaches();

// Pages that aren't prerendered (e.g. /fr/daily/2026-09-30) get the app shell, which routes on the client.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }));
