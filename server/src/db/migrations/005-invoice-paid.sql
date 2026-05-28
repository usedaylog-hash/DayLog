ALTER TABLE invoices ADD COLUMN paid_date TEXT;

INSERT OR IGNORE INTO invoice_config (key, value) VALUES ('tax_rate', '30');
