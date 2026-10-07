import { ArrowRight, CalendarDays, Grid3x3, Languages, Lightbulb, MoonStar, Sparkles, Trophy, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Dashboard } from '../components/home/Dashboard';
import { HeroScene } from '../components/home/HeroScene';
import { Reveal } from '../components/home/Reveal';
import { useNewGame } from '../components/modals/GameModals';
import { useLocale, useLocalePath } from '../hooks/useLocaleRoute';
import { formatNumber } from '../i18n/format';
import { LOCALES } from '../i18n/locales';
import { dateKey } from '../logic/daily';
import { TECHNIQUE_ORDER } from '../logic/techniques';
import { DIFFICULTIES } from '../logic/types';
import { useSeo } from '../seo/useSeo';
import { useGame } from '../store/hooks';

const btn = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-6 font-semibold transition-transform active:scale-[0.98]';

function Hero() {
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const resumable = useGame((s) => (s.game && (s.game.status === 'playing' || s.game.status === 'paused') ? s.game : null));
  const playPath = resumable
    ? resumable.puzzle.id.startsWith('daily-')
      ? path(`/daily/${resumable.puzzle.id.slice(6)}`)
      : path(`/play/${resumable.puzzle.difficulty}`)
    : path('/play/easy');

  const facts: [number, string][] = [
    [DIFFICULTIES.length, t('home.hero.facts.levels')],
    [TECHNIQUE_ORDER.length, t('home.hero.facts.techniques')],
    [LOCALES.length, t('home.hero.facts.languages')],
  ];

  return (
    <section className="relative overflow-hidden">
      <div aria-hidden="true" className="hero-backdrop pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-12 lg:grid-cols-[1.1fr_1fr] lg:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium">
            <Sparkles className="size-4 text-accent" aria-hidden="true" />
            {t('home.hero.badge')}
          </p>
          {/* No entrance animation on the heading: it is the page's largest paint. */}
          <h1 className="mt-5 text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            {t('home.hero.titleStart')} <span className="text-gradient">{t('home.hero.titleHighlight')}</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{t('home.hero.text')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={playPath} className={`${btn} bg-brand text-white shadow-lg shadow-accent/25`}>
              {resumable ? t('home.hero.resume') : t('home.hero.play')}
              <ArrowRight className="size-5 rtl:-scale-x-100" aria-hidden="true" />
            </Link>
            <Link to={path(`/daily/${dateKey()}`)} className={`${btn} border border-line bg-surface hover:bg-surface-2`}>
              <CalendarDays className="size-5 text-accent" aria-hidden="true" />
              {t('home.hero.daily')}
            </Link>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
            {facts.map(([value, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="text-3xl font-extrabold tabular-nums">{formatNumber(value, locale)}</dd>
                <dd className="text-sm text-muted">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <HeroScene />
      </div>
    </section>
  );
}

function SectionHeader({ id, title, text }: { id: string; title: string; text: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 id={id} className="text-2xl font-bold sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 text-muted">{text}</p>
    </div>
  );
}

function Levels() {
  const { t } = useTranslation();
  const newGame = useNewGame();
  return (
    <Reveal aria-labelledby="levels" className="mx-auto w-full max-w-6xl px-4 py-12">
      <SectionHeader id="levels" title={t('home.levels.title')} text={t('home.levels.text')} />
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {DIFFICULTIES.map((d, i) => (
          <li key={d} className="lift flex flex-col rounded-3xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{t(`difficulty.${d}`)}</h3>
              <span role="img" aria-label={t('home.levels.meter', { value: i + 1 })} className="flex gap-1">
                {DIFFICULTIES.map((_, k) => (
                  <span key={k} className={`h-4 w-1.5 rounded-full ${k <= i ? 'bg-brand' : 'bg-line'}`} />
                ))}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{t(`home.levels.${d}`)}</p>
            <button type="button" onClick={() => newGame(d)} className={`${btn} mt-auto min-h-11 w-full border border-line pt-0 text-sm hover:bg-surface-2`}>
              {t('home.levels.play')}
              <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

const FEATURES: { key: string; icon: ReactNode }[] = [
  { key: 'hints', icon: <Lightbulb className="size-5" aria-hidden="true" /> },
  { key: 'offline', icon: <WifiOff className="size-5" aria-hidden="true" /> },
  { key: 'languages', icon: <Languages className="size-5" aria-hidden="true" /> },
  { key: 'daily', icon: <CalendarDays className="size-5" aria-hidden="true" /> },
  { key: 'leaderboard', icon: <Trophy className="size-5" aria-hidden="true" /> },
  { key: 'themes', icon: <MoonStar className="size-5" aria-hidden="true" /> },
];

function Features() {
  const { t } = useTranslation();
  return (
    <Reveal aria-labelledby="features" className="mx-auto w-full max-w-6xl px-4 py-12">
      <SectionHeader id="features" title={t('home.features.title')} text={t('home.features.text')} />
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ key, icon }) => (
          <li key={key} className="lift rounded-3xl border border-line bg-surface p-6">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-brand text-white shadow-md shadow-accent/20">{icon}</span>
            <h3 className="mt-4 text-lg font-semibold">{t(`home.features.${key}.title`)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t(`home.features.${key}.text`)}</p>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

function Steps() {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <Reveal aria-labelledby="steps" className="mx-auto w-full max-w-6xl px-4 py-12">
      <h2 id="steps" className="text-center text-2xl font-bold sm:text-3xl">
        {t('home.steps.title')}
      </h2>
      <ol className="relative mt-8 grid gap-6 md:grid-cols-3">
        <span aria-hidden="true" className="absolute inset-x-[16%] top-6 hidden h-0.5 bg-gradient-to-r from-brand-a to-brand-b opacity-40 md:block" />
        {(['pick', 'solve', 'learn'] as const).map((step, i) => (
          <li key={step} className="relative flex flex-col items-center text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-white shadow-lg shadow-accent/25">
              {formatNumber(i + 1, locale)}
            </span>
            <h3 className="mt-4 text-lg font-semibold">{t(`home.steps.${step}.title`)}</h3>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{t(`home.steps.${step}.text`)}</p>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}

function CallToAction() {
  const { t } = useTranslation();
  const path = useLocalePath();
  return (
    <Reveal className="mx-auto w-full max-w-6xl px-4 pt-6 pb-12">
      <div className="bg-brand relative overflow-hidden rounded-[2rem] px-6 py-12 text-center text-white sm:px-12">
        <Grid3x3 aria-hidden="true" className="absolute -end-6 -top-6 size-40 opacity-15" />
        <Grid3x3 aria-hidden="true" className="absolute -bottom-8 -start-8 size-48 opacity-10" />
        <h2 className="relative text-2xl font-bold sm:text-3xl">{t('home.cta.title')}</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-white/90">{t('home.cta.text')}</p>
        <Link to={path('/play/easy')} className={`${btn} relative mt-7 bg-white text-[#1e3a8a]`}>
          {t('home.cta.button')}
          <ArrowRight className="size-5 rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      </div>
    </Reveal>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  useSeo({ title: t('seo.home.title'), description: t('seo.home.description') });
  return (
    <>
      <Hero />
      <Dashboard />
      <Levels />
      <Features />
      <Steps />
      <CallToAction />
    </>
  );
}
