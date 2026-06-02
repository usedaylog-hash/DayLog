CREATE TABLE IF NOT EXISTS tax_payments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  amount              REAL NOT NULL,
  payment_date        TEXT NOT NULL,
  quarter             INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  tax_year            INTEGER NOT NULL,
  payment_method      TEXT NOT NULL DEFAULT '',
  confirmation_number TEXT NOT NULL DEFAULT '',
  notes               TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
