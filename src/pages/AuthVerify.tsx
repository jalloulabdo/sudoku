import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useLocalePath } from '../hooks/useLocaleRoute';
import { useSeo } from '../seo/useSeo';
import { accountStore, type PublicUser } from '../store/accountStore';

/**
 * /:lang/auth/verify#token=… — the page the sign-in email links to. The token is read from the
 * URL fragment (never sent to the server as part of a URL) and exchanged for a session.
 */
export function AuthVerifyPage() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const started = useRef(false); // the token is single-use: never send it twice
  useSeo({ title: t('seo.login.title'), description: t('account.signInText'), noindex: true });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    history.replaceState(null, '', window.location.pathname); // drop the token from the address bar
    if (!token) {
      setFailed(true);
      return;
    }
    api<{ user: PublicUser }>('/api/auth/verify', { method: 'POST', body: { token } })
      .then(({ user }) => {
        accountStore.getState().setUser(user);
        navigate(path('/profile'), { replace: true });
      })
      .catch(() => setFailed(true));
  }, [navigate, path]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center" aria-live="polite">
      {failed ? (
        <>
          <h1 className="text-2xl font-bold">{t('account.verifyFailed')}</h1>
          <Link to={path('/login')} className="min-h-11 rounded-xl bg-accent px-5 py-2.5 font-medium text-accent-fg">
            {t('account.tryAgain')}
          </Link>
        </>
      ) : (
        <>
          <span className="size-8 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
          <h1 className="text-xl font-semibold">{t('account.verifying')}</h1>
        </>
      )}
    </div>
  );
}
