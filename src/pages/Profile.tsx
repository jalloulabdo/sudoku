import { LogOut, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, errorKey } from '../api/client';
import { Modal, ModalButton } from '../components/modals/Modal';
import { useLocale, useLocalePath } from '../hooks/useLocaleRoute';
import { formatDate } from '../i18n/format';
import { useSeo } from '../seo/useSeo';
import { accountStore, type PublicUser } from '../store/accountStore';
import { useAccount } from '../store/hooks';

const USERNAME_ERRORS = ['invalid_username', 'username_taken'];

function UsernameForm({ user }: { user: PublicUser }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(user.username ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setState('saving');
    try {
      const res = await api<{ user: PublicUser }>('/api/me', { method: 'PATCH', body: { username: value } });
      accountStore.getState().setUser(res.user);
      setState('saved');
    } catch (err) {
      setError(t(errorKey(err, USERNAME_ERRORS)));
      setState('idle');
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      {!user.username && <p className="rounded-xl bg-hint-focus p-3 text-sm">{t('account.chooseUsername')}</p>}
      <label htmlFor="username" className="text-sm font-medium">
        {t('account.username')}
      </label>
      <div className="flex gap-2">
        <input
          id="username"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setState('idle');
          }}
          autoComplete="username"
          maxLength={20}
          aria-invalid={error ? true : undefined}
          aria-describedby="username-help"
          className="min-h-12 flex-1 rounded-xl border border-line bg-surface px-3"
        />
        <button type="submit" disabled={state === 'saving'} className="min-h-12 rounded-xl bg-accent px-5 font-medium text-accent-fg disabled:opacity-60">
          {state === 'saving' ? t('account.saving') : t('account.save')}
        </button>
      </div>
      <p id="username-help" className="text-xs text-muted">
        {t('account.usernameHelp')}
      </p>
      <p role="status" className={`text-sm ${error ? 'text-error' : 'text-muted'}`}>
        {error ?? (state === 'saved' ? t('account.saved') : '')}
      </p>
    </form>
  );
}

export function ProfilePage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const navigate = useNavigate();
  const status = useAccount((s) => s.status);
  const user = useAccount((s) => s.user);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  useSeo({ title: t('seo.profile.title'), description: t('account.signInText'), noindex: true });

  if (status === 'signedOut') return <Navigate to={path('/login')} replace />;
  if (!user) {
    return (
      <p role="status" className="py-16 text-center text-muted">
        {t('account.loading')}
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-10">
      <header className="flex items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-cell-same text-entry" aria-hidden="true">
          <UserRound className="size-7" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{user.username ?? t('account.profileTitle')}</h1>
          <p dir="ltr" className="truncate text-start text-sm text-muted">
            {user.email}
          </p>
          <p className="text-xs text-muted">
            {t('account.memberSince', { date: formatDate(new Date(user.createdAt), locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <UsernameForm user={user} />
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void accountStore.getState().signOut().then(() => navigate(path(), { replace: true }))}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 font-medium hover:bg-surface-2"
        >
          <LogOut className="size-4 rtl:-scale-x-100" aria-hidden="true" />
          {t('account.signOut')}
        </button>
        <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 rounded-xl px-4 text-sm font-medium text-error hover:bg-cell-conflict">
          {t('account.deleteAccount')}
        </button>
      </div>

      <Modal open={confirmDelete} title={t('account.deleteTitle')} onClose={() => setConfirmDelete(false)}>
        <p className="text-muted">{t('account.deleteText')}</p>
        {deleteError && (
          <p role="alert" className="mt-3 text-sm text-error">
            {deleteError}
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <ModalButton
            variant="danger"
            onClick={() =>
              void accountStore
                .getState()
                .deleteAccount()
                .then(() => navigate(path(), { replace: true }))
                .catch((err) => setDeleteError(t(errorKey(err, []))))
            }
          >
            {t('account.deleteConfirm')}
          </ModalButton>
          <ModalButton onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</ModalButton>
        </div>
      </Modal>
    </div>
  );
}
