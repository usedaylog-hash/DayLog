CREATE TABLE IF NOT EXISTS expected_1099s (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tax_year         INTEGER NOT NULL,
  payer_name       TEXT NOT NULL,
  payer_tin_last4  TEXT NOT NULL DEFAULT '',
  expected_amount  REAL NOT NULL DEFAULT 0,
  received         INTEGER NOT NULL DEFAULT 0,
  received_amount  REAL,
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
