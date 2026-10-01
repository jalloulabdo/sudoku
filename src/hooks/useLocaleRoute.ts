import { useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { DEFAULT_LOCALE, isLocale, type Locale } from '../i18n/locales';
import { settingsStore } from '../store/settingsStore';

export function useLocale(): Locale {
  const { lang } = useParams();
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
}

/** Builds paths under the current language prefix: path('/stats') → '/fr/stats'. */
export function useLocalePath(): (path?: string) => string {
  const locale = useLocale();
  return useCallback((path = '') => `/${locale}${path}`, [locale]);
}

/** Switches language: same page under the new prefix, and remembers the choice. */
export function useSwitchLocale(): (next: Locale) => void {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (next: Locale) => {
      settingsStore.getState().update({ language: next });
      const rest = location.pathname.replace(/^\/[^/]+/, '');
      navigate(`/${next}${rest}${location.search}`, { replace: true });
    },
    [navigate, location],
  );
}
