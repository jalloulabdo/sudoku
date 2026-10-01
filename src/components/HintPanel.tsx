import { AnimatePresence, m } from 'framer-motion';
import { Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HintResult } from '../logic/techniques';
import { gameStore } from '../store/gameStore';
import { useGame } from '../store/hooks';

export function hintText(h: HintResult): { titleKey: string; bodyKey: string; params: Record<string, string | number> } | null {
  switch (h.kind) {
    case 'step':
      return { titleKey: `hints.${h.hint.technique}.title`, bodyKey: h.hint.i18nKey, params: h.hint.i18nParams };
    case 'mistake':
    case 'badNotes':
      return { titleKey: `hints.${h.kind}.title`, bodyKey: h.i18nKey, params: h.i18nParams };
    case 'none':
      return { titleKey: 'hints.none.title', bodyKey: h.i18nKey, params: {} };
    default:
      return null;
  }
}

/** Shows the technique and explanation for the current hint. Applying it is the second step. */
export function HintPanel() {
  const { t } = useTranslation();
  const hint = useGame((s) => s.activeHint);
  const text = hint && hintText(hint);

  return (
    <AnimatePresence>
      {text && (
        <m.section
          aria-live="polite"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="rounded-xl border border-line bg-hint-focus p-4 text-fg"
        >
          <h2 className="flex items-center gap-2 font-semibold">
            <Lightbulb className="size-5" aria-hidden="true" />
            {t(text.titleKey)}
          </h2>
          <p className="mt-1 text-sm leading-relaxed">{t(text.bodyKey, text.params)}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => gameStore.getState().hint()}
              className="min-h-11 rounded-lg bg-accent px-4 font-medium text-accent-fg"
            >
              {t('hints.apply')}
            </button>
            <button
              type="button"
              onClick={() => gameStore.getState().dismissHint()}
              className="min-h-11 rounded-lg px-4 font-medium hover:bg-hint-target"
            >
              {t('hints.dismiss')}
            </button>
          </div>
        </m.section>
      )}
    </AnimatePresence>
  );
}
