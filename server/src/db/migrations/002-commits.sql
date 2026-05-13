CREATE TABLE IF NOT EXISTS commits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  hash       TEXT NOT NULL,
  message    TEXT NOT NULL,
  author     TEXT NOT NULL,
  timestamp  TEXT NOT NULL,
  comment    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, hash)
);
