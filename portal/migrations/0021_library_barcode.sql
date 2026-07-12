-- Optional barcode on each library entry so bar managers can scan a
-- bottle and have Pour IQ auto-resolve it. We don't enforce strict
-- format (EAN-13, UPC-A, Code 128 all valid) — just store whatever
-- the scanner returns. Partial unique index guarantees one library
-- entry per (tenant, barcode) pair so scans return a single match.

ALTER TABLE pouriq_ingredients_library ADD COLUMN barcode TEXT;

CREATE UNIQUE INDEX uniq_pouriq_library_barcode_per_tenant
  ON pouriq_ingredients_library(trade_account_id, barcode)
  WHERE barcode IS NOT NULL;
