import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLocalePath } from '../hooks/useLocaleRoute';
import { DIFFICULTIES } from '../logic/types';

/** Plain links to every landing page: useful for people and for crawlers. */
export function Footer() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const link = 'inline-flex min-h-11 items-center text-muted hover:text-fg hover:underline';
  return (
    <footer className="mt-8 border-t border-line bg-surface">
      <nav aria-label={t('footer.label')} className="mx-auto grid max-w-5xl gap-6 px-4 py-6 text-sm sm:grid-cols-2">
        <div>
          <h2 className="mb-1 font-semibold">{t('footer.play')}</h2>
          <ul className="flex flex-wrap gap-x-4">
            {DIFFICULTIES.map((d) => (
              <li key={d}>
                <Link to={path(`/play/${d}`)} className={link}>
                  {t(`landing.${d}.heading`)}
                </Link>
              </li>
            ))}
            <li>
              <Link to={path('/daily')} className={link}>
                {t('nav.daily')}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="mb-1 font-semibold">{t('footer.learn')}</h2>
          <ul className="flex flex-wrap gap-x-4">
            <li>
              <Link to={path('/how-to-play')} className={link}>
                {t('nav.howTo')}
              </Link>
            </li>
            <li>
              <Link to={path('/stats')} className={link}>
                {t('nav.stats')}
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </footer>
  );
}
