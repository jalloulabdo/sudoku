import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLocalePath } from '../hooks/useLocaleRoute';
import { TECHNIQUE_LEVEL, TECHNIQUE_ORDER } from '../logic/techniques';
import type { Difficulty } from '../logic/types';
import { useSeo } from '../seo/useSeo';

const RULES = ['row', 'col', 'box', 'unique'] as const;
const CONTROLS = ['place', 'notes', 'hint', 'mistakes'] as const;
const KEYS = ['arrows', 'digits', 'erase', 'notes', 'undo', 'redo', 'pause'] as const;
/** The first difficulty that needs each technique level (see DIFFICULTY_PROFILES). */
const LEVEL_DIFFICULTY: Record<number, Difficulty> = { 1: 'easy', 2: 'medium', 3: 'hard', 4: 'expert' };

export function HowToPlayPage() {
  const { t } = useTranslation();
  const path = useLocalePath();
  useSeo({ title: t('seo.howTo.title'), description: t('seo.howTo.description') });

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 leading-relaxed">
      <header>
        <h1 className="text-3xl font-bold">{t('howTo.title')}</h1>
        <p className="mt-3 text-muted">{t('howTo.intro')}</p>
      </header>

      <section aria-labelledby="rules">
        <h2 id="rules" className="mb-3 text-xl font-semibold">
          {t('howTo.rulesTitle')}
        </h2>
        <ol className="list-decimal space-y-2 ps-6">
          {RULES.map((r) => (
            <li key={r}>{t(`howTo.rules.${r}`)}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="controls">
        <h2 id="controls" className="mb-3 text-xl font-semibold">
          {t('howTo.controlsTitle')}
        </h2>
        <ul className="list-disc space-y-2 ps-6">
          {CONTROLS.map((c) => (
            <li key={c}>{t(`howTo.controls.${c}`)}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="keyboard">
        <h2 id="keyboard" className="mb-3 text-xl font-semibold">
          {t('howTo.keyboardTitle')}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface p-4 text-sm">
          {KEYS.map((k) => (
            <div key={k} className="contents">
              <dt>
                <kbd dir="ltr" className="rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-xs whitespace-nowrap">
                  {t(`howTo.keys.${k}.key`)}
                </kbd>
              </dt>
              <dd>{t(`howTo.keys.${k}.action`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="techniques">
        <h2 id="techniques" className="text-xl font-semibold">
          {t('howTo.techniquesTitle')}
        </h2>
        <p className="mt-2 mb-4 text-muted">{t('howTo.techniquesIntro')}</p>
        <ol className="space-y-3">
          {TECHNIQUE_ORDER.map((tech) => (
            <li key={tech} className="rounded-2xl border border-line bg-surface p-4">
              <h3 className="font-semibold">{t(`hints.${tech}.title`)}</h3>
              <p className="mt-1 text-sm">{t(`hints.${tech}.summary`)}</p>
              <p className="mt-2 text-xs text-muted">
                {t('howTo.usedFrom', { difficulty: t(`difficulty.${LEVEL_DIFFICULTY[TECHNIQUE_LEVEL[tech]]}`) })}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <Link to={path('/play/easy')} className="flex min-h-12 items-center justify-center self-start rounded-xl bg-accent px-6 font-medium text-accent-fg">
        {t('howTo.cta')}
      </Link>
    </article>
  );
}
