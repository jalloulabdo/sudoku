import { AnimatePresence, m } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const OFFLINE_READY_MS = 4000;

/**
 * A new version never reloads on its own (that could interrupt a game): the player chooses
 * when. Also confirms once that the app is ready to work offline.
 */
export function UpdateToast() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  const close = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  // "Ready offline" is informational: hide it on its own so it doesn't cover the keypad.
  useEffect(() => {
    if (!offlineReady || needRefresh) return;
    const timer = setTimeout(() => setOfflineReady(false), OFFLINE_READY_MS);
    return () => clearTimeout(timer);
  }, [offlineReady, needRefresh, setOfflineReady]);

  return (
    <AnimatePresence>
      {(needRefresh || offlineReady) && (
        <m.div
          role="status"
          // Slide only, no fade: text is never shown at reduced contrast.
          initial={{ y: 120 }}
          animate={{ y: 0 }}
          exit={{ y: 120 }}
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-fg shadow-xl"
        >
          <RefreshCw className="size-5 shrink-0 text-accent" aria-hidden="true" />
          <p className="flex-1 text-sm">{needRefresh ? t('update.available') : t('update.offlineReady')}</p>
          {needRefresh && (
            <button
              type="button"
              onClick={() => void updateServiceWorker(true)}
              className="min-h-11 rounded-lg bg-accent px-3 text-sm font-medium text-accent-fg"
            >
              {t('update.reload')}
            </button>
          )}
          <button type="button" onClick={close} className="min-h-11 rounded-lg px-3 text-sm font-medium hover:bg-surface-2">
            {needRefresh ? t('update.later') : t('common.close')}
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
