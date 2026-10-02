import type { Locale } from '../src/i18n/locales';
import type { Ctx, Env } from './env';
import { HttpError } from './http';

const TEXT: Record<Locale, { subject: string; intro: string; button: string; ignore: string }> = {
  en: {
    subject: 'Your Sudoku Master sign-in link',
    intro: 'Click the button below to sign in to Sudoku Master. The link works once and expires in 15 minutes.',
    button: 'Sign in',
    ignore: "If you didn't ask for this email, you can ignore it.",
  },
  fr: {
    subject: 'Votre lien de connexion à Sudoku Master',
    intro: "Cliquez sur le bouton ci-dessous pour vous connecter à Sudoku Master. Le lien ne fonctionne qu'une fois et expire dans 15 minutes.",
    button: 'Se connecter',
    ignore: "Si vous n'avez pas demandé cet e-mail, vous pouvez l'ignorer.",
  },
  ar: {
    subject: 'رابط تسجيل الدخول إلى سودوكو ماستر',
    intro: 'اضغط على الزر أدناه لتسجيل الدخول إلى سودوكو ماستر. يعمل الرابط مرة واحدة وتنتهي صلاحيته خلال 15 دقيقة.',
    button: 'تسجيل الدخول',
    ignore: 'إذا لم تطلب هذه الرسالة، يمكنك تجاهلها.',
  },
};

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function loginEmail(locale: Locale, to: string, link: string) {
  const t = TEXT[locale];
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const html = `<!doctype html><html lang="${locale}" dir="${dir}"><body style="font-family:system-ui,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">Sudoku Master</h1>
<p style="line-height:1.6">${escapeHtml(t.intro)}</p>
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">${escapeHtml(t.button)}</a></p>
<p style="color:#475569;font-size:13px;line-height:1.6">${escapeHtml(t.ignore)}</p>
</div></body></html>`;
  return { to, subject: t.subject, html, text: `${t.intro}\n\n${link}\n\n${t.ignore}` };
}

/** Sends through Resend; in development without a key, prints the message instead. */
export function createMailer(env: Env): Ctx['mail'] {
  return async (msg) => {
    if (!env.RESEND_API_KEY) {
      if (env.APP_ENV === 'development') {
        console.log(`\n[dev mail] to ${msg.to}: ${msg.subject}\n${msg.text}\n`);
        return;
      }
      throw new HttpError(503, 'email_not_configured');
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM ?? 'Sudoku Master <onboarding@resend.dev>', ...msg }),
    });
    if (!res.ok) {
      console.error('Resend error', res.status, await res.text());
      throw new HttpError(502, 'email_failed');
    }
  };
}
