import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocale, useSwitchLocale } from '../hooks/useLocaleRoute';
import { LOCALES, isLocale } from '../i18n/locales';

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const locale = useLocale();
  const switchLocale = useSwitchLocale();
  return (
    <label className="relative flex min-h-11 items-center gap-1 rounded-full px-2 text-sm hover:bg-surface-2">
      <Languages className="size-5 text-muted" aria-hidden="true" />
      <span className="sr-only">{t('nav.language')}</span>
      <select
        value={locale}
        onChange={(e) => isLocale(e.target.value) && switchLocale(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pe-1 font-medium outline-none"
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
