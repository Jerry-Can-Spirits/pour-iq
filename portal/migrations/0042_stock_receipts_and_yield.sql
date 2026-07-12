-- Phase 3a: perpetual stock. Receipts (deliveries) top stock up; yield_pct is
-- the keg/line-wastage factor feeding depletion. Both additive; yield defaults
-- to 100 (no change to existing ingredients or variance behaviour).
CREATE TABLE pouriq_stock_receipts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trade_account_id TEXT NOT NULL,
  library_ingredient_id TEXT NOT NULL REFERENCES pouriq_ingredients_library(id) ON DELETE CASCADE,
  received_at TEXT NOT NULL,
  qty REAL NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('invoice','manual')),
  invoice_line_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_stock_receipts_lookup
  ON pouriq_stock_receipts (trade_account_id, library_ingredient_id, received_at);
CREATE UNIQUE INDEX uniq_stock_receipts_invoice_line
  ON pouriq_stock_receipts (invoice_line_id) WHERE invoice_line_id IS NOT NULL;

ALTER TABLE pouriq_ingredients_library ADD COLUMN yield_pct REAL NOT NULL DEFAULT 100;
