CREATE TABLE IF NOT EXISTS sessions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  clock_in  TEXT NOT NULL,
  clock_out TEXT,
  summary   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  content    TEXT NOT NULL,
  timestamp  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
