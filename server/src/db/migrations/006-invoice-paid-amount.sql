ALTER TABLE invoices ADD COLUMN paid_amount REAL DEFAULT 0;
UPDATE invoices SET paid_amount = total_amount WHERE paid_date IS NOT NULL;
