-- 0025_pouriq_invoices.sql
-- Adds AI invoice scanning: invoices, invoice line items, cost-change audit log.

CREATE TABLE pouriq_invoices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trade_account_id TEXT NOT NULL REFERENCES pouriq_trade_accounts(id) ON DELETE CASCADE,
  supplier_name TEXT,
  invoice_number TEXT,
  invoice_date TEXT,
  net_total_p INTEGER,
  line_count INTEGER NOT NULL,
  applied_line_count INTEGER NOT NULL,
  r2_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_pouriq_invoices_tenant ON pouriq_invoices(trade_account_id, created_at DESC);

CREATE TABLE pouriq_invoice_lines (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  invoice_id TEXT NOT NULL REFERENCES pouriq_invoices(id) ON DELETE CASCADE,
  extracted_name TEXT NOT NULL,
  extracted_quantity INTEGER,
  extracted_unit_price_p INTEGER NOT NULL,
  extracted_line_total_p INTEGER,
  matched_library_id TEXT REFERENCES pouriq_ingredients_library(id) ON DELETE SET NULL,
  applied INTEGER NOT NULL DEFAULT 0 CHECK (applied IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_pouriq_invoice_lines_invoice ON pouriq_invoice_lines(invoice_id);

CREATE TABLE pouriq_cost_changes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  library_ingredient_id TEXT NOT NULL REFERENCES pouriq_ingredients_library(id) ON DELETE CASCADE,
  pricing_mode TEXT NOT NULL CHECK (pricing_mode IN ('bottle', 'unit')),
  old_cost_p INTEGER,
  new_cost_p INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual', 'invoice')),
  invoice_id TEXT REFERENCES pouriq_invoices(id) ON DELETE SET NULL,
  invoice_line_id TEXT REFERENCES pouriq_invoice_lines(id) ON DELETE SET NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_pouriq_cost_changes_ingredient ON pouriq_cost_changes(library_ingredient_id, changed_at DESC);
CREATE INDEX idx_pouriq_cost_changes_invoice ON pouriq_cost_changes(invoice_id);
