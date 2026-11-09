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
