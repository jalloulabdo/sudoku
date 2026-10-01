import { useTranslation } from 'react-i18next';
import { useLocale, useSwitchLocale } from '../../hooks/useLocaleRoute';
import { LOCALES, isLocale } from '../../i18n/locales';
import { useSettings, useUi } from '../../store/hooks';
import { settingsStore, type Settings, type Theme } from '../../store/settingsStore';
import { uiStore } from '../../store/uiStore';
import { Modal } from './Modal';

type ToggleKey = 'highlightConflicts' | 'highlightSameDigit' | 'autoRemoveNotes' | 'showTimer';
const TOGGLES: ToggleKey[] = ['highlightConflicts', 'highlightSameDigit', 'autoRemoveNotes', 'showTimer'];
const THEMES: Theme[] = ['light', 'dark', 'system'];

function Segmented<T extends string>(props: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{props.label}</legend>
      <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={props.value === o.value}
            onClick={() => props.onChange(o.value)}
            className="min-h-11 flex-1 rounded-lg px-2 text-sm aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:shadow-sm"
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
      <span className="text-sm">{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative h-6 w-11 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent after:absolute after:start-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5"
      />
    </label>
  );
}

export function SettingsModal() {
  const { t } = useTranslation();
  const open = useUi((s) => s.settingsOpen);
  const locale = useLocale();
  const switchLocale = useSwitchLocale();
  const settings = useSettings((s) => s);
  const update = (patch: Partial<Settings>) => settingsStore.getState().update(patch);

  return (
    <Modal open={open} title={t('settings.title')} onClose={() => uiStore.setState({ settingsOpen: false })}>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t('settings.language')}</span>
          <select
            value={locale}
            onChange={(e) => isLocale(e.target.value) && switchLocale(e.target.value)}
            className="min-h-11 rounded-xl border border-line bg-surface px-3"
          >
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.nativeName}
              </option>
            ))}
          </select>
        </label>

        <Segmented
          label={t('settings.theme')}
          value={settings.theme}
          options={THEMES.map((v) => ({ value: v, label: t(`theme.${v}`) }))}
          onChange={(theme) => update({ theme })}
        />

        <Segmented
          label={t('settings.mistakeLimit')}
          value={settings.mistakeLimit === null ? 'off' : '3'}
          options={[
            { value: '3', label: t('settings.mistakeLimit3') },
            { value: 'off', label: t('settings.mistakeLimitOff') },
          ]}
          onChange={(v) => update({ mistakeLimit: v === 'off' ? null : 3 })}
        />

        <div className="flex flex-col gap-1">
          {TOGGLES.map((key) => (
            <Toggle key={key} label={t(`settings.${key}`)} checked={settings[key]} onChange={(v) => update({ [key]: v })} />
          ))}
        </div>
      </div>
    </Modal>
  );
}
