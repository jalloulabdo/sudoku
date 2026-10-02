import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: { sitekey: string; language?: string; callback: (token: string) => void; 'expired-callback': () => void }): string;
      remove(id: string): void;
    };
  }
}

/** Public site key; the widget is skipped entirely when it isn't configured (local development). */
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

let scriptLoading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  scriptLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile'));
    document.head.appendChild(s);
  });
  return scriptLoading;
}

/** Cloudflare Turnstile bot check. Calls onToken with a token, or null when it expires. */
export function Turnstile({ language, onToken }: { language: string; onToken: (token: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let id: string | undefined;
    let cancelled = false;
    void loadScript().then(() => {
      if (cancelled || !box.current || !window.turnstile) return;
      id = window.turnstile.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        language,
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(null),
      });
    });
    return () => {
      cancelled = true;
      if (id) window.turnstile?.remove(id);
    };
  }, [language, onToken]);
  return TURNSTILE_SITE_KEY ? <div ref={box} className="min-h-[65px]" /> : null;
}
