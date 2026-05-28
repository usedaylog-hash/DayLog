CREATE TABLE IF NOT EXISTS invoices (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date   TEXT NOT NULL,
  period_start   TEXT NOT NULL,
  period_end     TEXT NOT NULL,
  hourly_rate    REAL NOT NULL,
  total_hours    REAL NOT NULL,
  total_amount   REAL NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- Seed default config keys
INSERT OR IGNORE INTO invoice_config (key, value) VALUES
  ('contractor_name', ''),
  ('contractor_address', ''),
  ('contractor_city_state_zip', ''),
  ('contractor_ubi', ''),
  ('contractor_tax_id_last4', ''),
  ('contractor_phone', ''),
  ('contractor_email', ''),
  ('client_name', ''),
  ('client_company', ''),
  ('client_address', ''),
  ('client_city_state_zip', ''),
  ('hourly_rate', '20');
