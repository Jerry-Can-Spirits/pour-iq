-- Accounting integrations (Xero + QuickBooks Online).
-- pouriq_accounting_connections mirrors pouriq_pos_connections (0023):
-- one row per venue+provider, tokens in D1 (encrypted at rest).
-- pouriq_accounting_pushes is both the idempotency guard (an invoice can
-- never reach the same provider twice, even across reconnects) and the
-- retry queue (failed rows are re-attempted by the hourly sweep).

CREATE TABLE pouriq_accounting_connections (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trade_account_id TEXT NOT NULL REFERENCES trade_accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('xero', 'quickbooks')),
  external_account_id TEXT NOT NULL DEFAULT '',
  external_account_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TEXT,
  default_account_code TEXT,
  default_tax_code TEXT,
  last_push_at TEXT,
  last_push_error TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(trade_account_id, provider)
);

CREATE TABLE pouriq_accounting_pushes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  invoice_id TEXT NOT NULL REFERENCES pouriq_invoices(id) ON DELETE CASCADE,
  connection_id TEXT REFERENCES pouriq_accounting_connections(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('xero', 'quickbooks')),
  status TEXT NOT NULL CHECK (status IN ('pushed', 'failed')),
  external_bill_id TEXT,
  error TEXT,
  pushed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(invoice_id, provider)
);

CREATE INDEX idx_pouriq_accounting_pushes_invoice ON pouriq_accounting_pushes(invoice_id);

-- Commit-time VAT basis, needed by the retry sweep to build the bill with
-- the right inclusive/exclusive tax flag. NULL for pre-existing invoices
-- (treated as exclusive, matching how their totals were summed).
ALTER TABLE pouriq_invoices ADD COLUMN prices_include_vat INTEGER;
