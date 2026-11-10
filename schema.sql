CREATE TABLE IF NOT EXISTS games (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  status    TEXT NOT NULL,
  rating    INTEGER,
  developer TEXT,
  released  TEXT,
  genres    TEXT NOT NULL DEFAULT '[]',
  added     TEXT NOT NULL,
  cover     TEXT,
  notes     TEXT NOT NULL DEFAULT '',
  updated   TEXT
);

-- Public "suggest a game" box. ip_hash is a salted hash, used only for rate limiting.
CREATE TABLE IF NOT EXISTS suggestions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  game      TEXT NOT NULL,
  from_name TEXT,
  message   TEXT NOT NULL DEFAULT '',
  created   TEXT NOT NULL,
  ip_hash   TEXT
);
CREATE INDEX IF NOT EXISTS suggestions_ip ON suggestions (ip_hash, created);
