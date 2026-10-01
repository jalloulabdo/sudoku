import { BarChart3, CalendarDays, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
import { useLocalePath } from '../hooks/useLocaleRoute';
import { uiStore } from '../store/uiStore';
import { LanguageSwitcher } from './LanguageSwitcher';

const navItem =
  'flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg aria-[current=page]:text-accent';

export function Header() {
  const { t } = useTranslation();
  const path = useLocalePath();
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
        <Link to={path()} aria-label={t('app.name')} className="me-auto flex items-center gap-2 text-lg font-bold">
          <span aria-hidden="true" className="grid size-8 grid-cols-2 gap-0.5 rounded-lg bg-accent p-1.5">
            <span className="rounded-sm bg-accent-fg" />
            <span className="rounded-sm bg-accent-fg/50" />
            <span className="rounded-sm bg-accent-fg/50" />
            <span className="rounded-sm bg-accent-fg" />
          </span>
          <span className="hidden sm:inline">{t('app.name')}</span>
        </Link>
        <nav aria-label={t('nav.main')} className="flex items-center">
          <NavLink to={path('/daily')} className={navItem} aria-label={t('nav.daily')}>
            <CalendarDays className="size-5" aria-hidden="true" />
            <span className="hidden md:inline">{t('nav.daily')}</span>
          </NavLink>
          <NavLink to={path('/stats')} className={navItem} aria-label={t('nav.stats')}>
            <BarChart3 className="size-5" aria-hidden="true" />
            <span className="hidden md:inline">{t('nav.stats')}</span>
          </NavLink>
        </nav>
        <LanguageSwitcher />
        <button
          type="button"
          onClick={() => uiStore.setState({ settingsOpen: true })}
          aria-label={t('nav.settings')}
          className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
        >
          <Settings className="size-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
