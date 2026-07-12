-- Ingredient model slice 1: unify the purchase model. Adds neutral columns
-- (base_unit/pack_size/price_p/pack_format/subcategory) and drops the legacy
-- bottle_size_ml/bottle_cost_p/unit_cost_p. Table rebuild because the old CHECK
-- references the dropped columns and there are inbound foreign keys.
--
-- ingredient_type CHECK is intentionally omitted on the new table so categories
-- stay flexible (soft-drink, food, etc.) without requiring another rebuild.
-- The old uniqueness index referenced bottle_size_ml; it is recreated against
-- pack_size (same semantic: deduplicate by tenant, name, and pack size).
--
-- Apply with:
--   wrangler d1 execute jerry-can-spirits-db --local  --file=migrations/0043_ingredient_purchase_model.sql
--   wrangler d1 execute jerry-can-spirits-db --remote --file=migrations/0043_ingredient_purchase_model.sql

PRAGMA foreign_keys=OFF;

CREATE TABLE pouriq_ingredients_library_new (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trade_account_id TEXT NOT NULL REFERENCES trade_accounts(id),
  name             TEXT NOT NULL,
  ingredient_type  TEXT NOT NULL,
  base_unit        TEXT NOT NULL DEFAULT 'ml',
  pack_size        REAL NOT NULL DEFAULT 1,
  price_p          INTEGER NOT NULL DEFAULT 0,
  purchase_qty     INTEGER NOT NULL DEFAULT 1,
  yield_pct        REAL NOT NULL DEFAULT 100,
  pack_format      TEXT,
  subcategory      TEXT,
  barcode          TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (base_unit IN ('ml','g','each') AND pack_size > 0 AND price_p >= 0)
);

INSERT INTO pouriq_ingredients_library_new
  (id, trade_account_id, name, ingredient_type, base_unit, pack_size, price_p,
   purchase_qty, yield_pct, pack_format, subcategory, barcode, notes, created_at, updated_at)
SELECT
  id,
  trade_account_id,
  name,
  ingredient_type,
  CASE WHEN bottle_size_ml IS NOT NULL THEN 'ml' ELSE 'each' END,
  COALESCE(bottle_size_ml, 1),
  COALESCE(bottle_cost_p, unit_cost_p, 0),
  purchase_qty,
  yield_pct,
  NULL,
  NULL,
  barcode,
  notes,
  created_at,
  updated_at
FROM pouriq_ingredients_library;

DROP TABLE pouriq_ingredients_library;
ALTER TABLE pouriq_ingredients_library_new RENAME TO pouriq_ingredients_library;

-- Recreate the original indexes with their exact names:
-- 1. Simple lookup index on trade_account_id (unchanged)
CREATE INDEX idx_pouriq_lib_trade_account
  ON pouriq_ingredients_library(trade_account_id);

-- 2. Uniqueness index: was (trade_account_id, LOWER(name), COALESCE(bottle_size_ml, -1)).
--    pack_size replaces bottle_size_ml and is NOT NULL, so no COALESCE is needed.
CREATE UNIQUE INDEX idx_pouriq_lib_uniqueness
  ON pouriq_ingredients_library(trade_account_id, LOWER(name), pack_size);

-- 3. Barcode uniqueness per tenant (partial; from migration 0021)
CREATE UNIQUE INDEX uniq_pouriq_library_barcode_per_tenant
  ON pouriq_ingredients_library(trade_account_id, barcode)
  WHERE barcode IS NOT NULL;

PRAGMA foreign_keys=ON;
