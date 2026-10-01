import { WifiOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOfflineStatus } from '../hooks/useOfflineStatus';

/** Small, dismissible notice while offline. Shows again the next time the connection drops. */
export function OfflineBanner() {
  const { t } = useTranslation();
  const offline = useOfflineStatus();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!offline) setDismissed(false);
  }, [offline]);

  if (!offline || dismissed) return null;
  return (
    <div role="status" className="border-b border-line bg-surface-2">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-1.5 text-sm">
        <WifiOff className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span className="flex-1">{t('offline.message')}</span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t('common.close')}
          className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
