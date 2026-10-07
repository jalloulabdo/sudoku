import { LazyMotion, MotionConfig } from 'framer-motion';
import { Suspense, lazy, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useNavigate, useParams, type RouteObject } from 'react-router-dom';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { OfflineBanner } from './components/OfflineBanner';
import { SettingsModal } from './components/modals/SettingsModal';
import { useLocalePath } from './hooks/useLocaleRoute';
import { useTheme } from './hooks/useTheme';
import i18n, { applyLocale, resolveLocale } from './i18n';
import { LOCALES, isLocale } from './i18n/locales';
import { DIFFICULTIES } from './logic/types';
import { DailyPlayPage, PlayPage } from './pages/Play';
import { useSeo } from './seo/useSeo';

// Registers the service worker, so it only exists in the browser.
const UpdateToast = lazy(() => import('./components/UpdateToast').then((m) => ({ default: m.UpdateToast })));

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? children : null;
}

/**
 * '/' — sends visitors to their language. The static HTML is a language chooser, which is
 * also what crawlers and the hreflang x-default link see.
 */
function RootPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useSeo({ title: t('seo.home.title'), description: t('seo.home.description'), isRoot: true });
  useEffect(() => navigate(`/${resolveLocale()}`, { replace: true }), [navigate]);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-8 px-4 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          <span className="text-gradient">{t('root.title')}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-muted">{t('root.text')}</p>
      </header>
      <section aria-labelledby="root-languages">
        <h2 id="root-languages" className="mb-3 text-center text-lg font-semibold">
          {t('root.choose')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {LOCALES.map((l) => (
            <li key={l.code}>
              {/* Each language introduces itself in its own words. */}
              <a
                href={`/${l.code}`}
                lang={l.code}
                dir={l.dir}
                className="lift flex h-full flex-col gap-1 rounded-2xl border border-line bg-surface p-4"
              >
                <span className="text-lg font-bold">{l.nativeName}</span>
                <span className="text-sm text-muted">{i18n.getFixedT(l.code)('app.tagline')}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <nav aria-labelledby="root-levels" className="text-center">
        <h2 id="root-levels" className="mb-2 text-sm font-semibold text-muted">
          {t('root.levels')}
        </h2>
        <ul className="flex flex-wrap justify-center gap-2">
          {DIFFICULTIES.map((d) => (
            <li key={d}>
              <a href={`/en/play/${d}`} className="inline-flex min-h-11 items-center rounded-xl bg-surface-2 px-4 text-sm font-medium">
                {t(`landing.${d}.heading`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}

function LocaleLayout() {
  const { t } = useTranslation();
  const { lang } = useParams();
  const valid = isLocale(lang);
  useTheme();
  // Before paint, so the page never flashes in the wrong language or direction.
  useIsomorphicLayoutEffect(() => {
    if (valid) applyLocale(lang);
  }, [valid, lang]);

  if (!valid) return <RootPage />;
  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-accent px-4 py-2 text-accent-fg focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
        >
          {t('common.skipToContent')}
        </a>
        <Header />
        <OfflineBanner />
        <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          <Outlet />
        </main>
        <Footer />
        <SettingsModal />
        <ClientOnly>
          <Suspense fallback={null}>
            <UpdateToast />
          </Suspense>
        </ClientOnly>
      </div>
    </MotionConfig>
  );
}

function NotFoundPage() {
  const { t } = useTranslation();
  const path = useLocalePath();
  useSeo({ title: t('seo.notFound.title'), description: t('seo.home.description'), noindex: true });
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{t('notFound.title')}</h1>
      <Link to={path()} className="min-h-11 rounded-xl bg-accent px-5 py-2.5 font-medium text-accent-fg">
        {t('notFound.back')}
      </Link>
    </div>
  );
}

const loadMotionFeatures = () => import('./motionFeatures').then((m) => m.default);

/** framer-motion's animation features load in the background; until then elements just appear. */
function Root() {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <Outlet />
    </LazyMotion>
  );
}

/**
 * Route table, shared by the browser router and the static prerenderer. Less-visited pages
 * are separate chunks; they are all precached, so they still work offline.
 */
export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      { path: '/', element: <RootPage /> },
      {
        path: '/:lang',
        element: <LocaleLayout />,
        children: [
          // Lazy too: its HTML is prerendered (the headline paints before any JS), and keeping
          // the hero scene and dashboard out of the main bundle keeps game pages fast.
          { index: true, lazy: async () => ({ Component: (await import('./pages/Home')).HomePage }) },
          { path: 'play/:difficulty', element: <PlayPage /> },
          { path: 'daily', lazy: async () => ({ Component: (await import('./pages/Daily')).DailyPage }) },
          { path: 'daily/:date', element: <DailyPlayPage /> },
          { path: 'stats', lazy: async () => ({ Component: (await import('./pages/Stats')).StatsPage }) },
          { path: 'how-to-play', lazy: async () => ({ Component: (await import('./pages/HowToPlay')).HowToPlayPage }) },
          { path: 'leaderboard', lazy: async () => ({ Component: (await import('./pages/Leaderboard')).LeaderboardPage }) },
          { path: 'login', lazy: async () => ({ Component: (await import('./pages/Login')).LoginPage }) },
          { path: 'auth/verify', lazy: async () => ({ Component: (await import('./pages/AuthVerify')).AuthVerifyPage }) },
          { path: 'profile', lazy: async () => ({ Component: (await import('./pages/Profile')).ProfilePage }) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
