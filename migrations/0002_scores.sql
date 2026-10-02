-- Server-verified scores and leaderboards.

-- Issued when a signed-in player starts a puzzle; the finish must fit the time since then.
CREATE TABLE game_tickets (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id    TEXT NOT NULL,
  difficulty   TEXT NOT NULL,
  givens       TEXT NOT NULL,           -- 81 characters, '0' = empty
  daily_key    TEXT,                    -- YYYY-MM-DD when this is that day's official daily puzzle
  started_at   INTEGER NOT NULL,
  finished_at  INTEGER
);
CREATE INDEX game_tickets_user_puzzle ON game_tickets(user_id, puzzle_id);

CREATE TABLE scores (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_id    TEXT NOT NULL UNIQUE,
  puzzle_id    TEXT NOT NULL,
  difficulty   TEXT NOT NULL,
  daily_key    TEXT,
  elapsed_ms   INTEGER NOT NULL,
  mistakes     INTEGER NOT NULL,
  hints        INTEGER NOT NULL,
  points       INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  UNIQUE (user_id, puzzle_id)           -- a puzzle scores once per player
);
CREATE INDEX scores_created ON scores(created_at);
CREATE INDEX scores_user ON scores(user_id);
CREATE INDEX scores_daily ON scores(daily_key, points DESC, elapsed_ms) WHERE daily_key IS NOT NULL;
