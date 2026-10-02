import { MailCheck } from 'lucide-react';
import { useCallback, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { api, errorKey } from '../api/client';
import { TURNSTILE_SITE_KEY, Turnstile } from '../components/Turnstile';
import { useLocale, useLocalePath } from '../hooks/useLocaleRoute';
import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { useSeo } from '../seo/useSeo';
import { useAccount } from '../store/hooks';

const REQUEST_ERRORS = ['invalid_email', 'rate_limited', 'captcha_required', 'captcha_failed'];

export function LoginPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const offline = useOfflineStatus();
  const signedIn = useAccount((s) => s.status === 'signedIn');
  const [email, setEmail] = useState('');
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const onToken = useCallback((token: string | null) => setCaptcha(token), []);
  useSeo({ title: t('seo.login.title'), description: t('account.signInText'), noindex: true });

  if (signedIn) return <Navigate to={path('/profile')} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setState('sending');
    try {
      await api('/api/auth/request', { method: 'POST', body: { email, locale, turnstileToken: captcha ?? undefined } });
      setState('sent');
    } catch (err) {
      setError(t(errorKey(err, REQUEST_ERRORS)));
      setState('idle');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-10">
      {state === 'sent' ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-6 text-center" aria-live="polite">
          <MailCheck className="size-12 text-accent" aria-hidden="true" />
          <h1 className="text-2xl font-bold">{t('account.sentTitle')}</h1>
          <p className="text-muted">{t('account.sentText', { email: email.trim() })}</p>
          <button type="button" onClick={() => setState('idle')} className="min-h-11 rounded-xl px-4 font-medium text-accent hover:bg-surface-2">
            {t('account.useAnother')}
          </button>
        </section>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6" noValidate>
          <h1 className="text-2xl font-bold">{t('account.signInTitle')}</h1>
          <p className="text-muted">{t('account.signInText')}</p>
          {offline && <p className="rounded-xl bg-surface-2 p-3 text-sm">{t('account.offline')}</p>}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('account.email')}</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'login-error' : undefined}
              className="min-h-12 rounded-xl border border-line bg-surface px-3 text-start"
            />
          </label>
          <Turnstile language={locale} onToken={onToken} />
          {error && (
            <p id="login-error" role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={state === 'sending' || offline || (!!TURNSTILE_SITE_KEY && !captcha)}
            className="min-h-12 rounded-xl bg-accent font-medium text-accent-fg disabled:opacity-60"
          >
            {state === 'sending' ? t('account.sending') : t('account.sendLink')}
          </button>
        </form>
      )}
    </div>
  );
}
