import { useEffect } from 'react';
import { useSettings } from '../store/hooks';

/** Keeps the `dark` class on <html> in sync with the theme setting and the OS preference. */
export function useTheme(): void {
  const theme = useSettings((s) => s.theme);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && !!media?.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1120' : '#f8fafc');
    };
    apply();
    if (theme !== 'system' || !media) return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
