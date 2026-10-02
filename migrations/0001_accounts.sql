-- Accounts and magic-link sign-in.

CREATE TABLE users (
  id          TEXT PRIMARY KEY,                 -- random, URL-safe
  email       TEXT NOT NULL UNIQUE,             -- stored lower-cased
  username    TEXT UNIQUE COLLATE NOCASE,       -- chosen after the first sign-in
  locale      TEXT NOT NULL DEFAULT 'en',       -- language for emails
  created_at  INTEGER NOT NULL                  -- ms since epoch
);

-- Only hashes of session and login tokens are stored, never the tokens themselves.
CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE login_tokens (
  token_hash  TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  locale      TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER                           -- single use
);
CREATE INDEX login_tokens_email ON login_tokens(email);

-- Fixed-window counters for rate limiting (key = action + email/IP).
CREATE TABLE rate_limits (
  key           TEXT PRIMARY KEY,
  window_start  INTEGER NOT NULL,
  count         INTEGER NOT NULL
);
