-- Index was created in 0025 but dropped when 0033 rebuilt pouriq_invoices to fix an FK typo
CREATE INDEX IF NOT EXISTS idx_pouriq_invoices_tenant ON pouriq_invoices(trade_account_id, created_at DESC);
