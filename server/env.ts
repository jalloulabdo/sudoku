import type { Db } from './db';

/** Bindings and secrets available to the API (see wrangler.toml). */
export interface Env {
  DB: Db;
  /** 'development' prints magic links to the log instead of emailing them. */
  APP_ENV?: string;
  /** Resend API key (https://resend.com). Required to send email in production. */
  RESEND_API_KEY?: string;
  /** Sender, e.g. "Sudoku Master <login@your-domain.com>" (the domain must be verified in Resend). */
  EMAIL_FROM?: string;
  /** Cloudflare Turnstile secret. When set, sign-in requests must pass a Turnstile check. */
  TURNSTILE_SECRET?: string;
}

/** Everything a handler needs; injectable for tests. */
export interface Ctx {
  env: Env;
  request: Request;
  url: URL;
  now: number;
  /** Sends an email. Replaced by a recorder in tests. */
  mail: (msg: { to: string; subject: string; text: string; html: string }) => Promise<void>;
}
