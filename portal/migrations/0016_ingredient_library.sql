-- Pour IQ ingredient library: tenant-scoped table holding the ingredients
-- a venue buys. pouriq_ingredients (per-cocktail) reshapes to FK into the
-- library instead of duplicating name/size/cost inline.
--
-- Apply with:
--   wrangler d1 execute jerry-can-spirits-db --local --file=migrations/0016_ingredient_library.sql
--   wrangler d1 execute jerry-can-spirits-db --remote --file=migrations/0016_ingredient_library.sql
--
-- This migration is destructive (drops columns). Take a manual D1 export
-- before running remote:
--   wrangler d1 export jerry-can-spirits-db --remote --output=pre-0016-backup.sql

-- 1. Create the library table
CREATE TABLE pouriq_ingredients_library (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trade_account_id TEXT NOT NULL REFERENCES trade_accounts(id),
  name             TEXT NOT NULL,
  ingredient_type  TEXT NOT NULL CHECK(ingredient_type IN ('spirit','liqueur','wine','beer','mixer','syrup','juice','garnish','other')),
  bottle_size_ml   REAL,
  bottle_cost_p    INTEGER,
  unit_cost_p      INTEGER,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (bottle_size_ml IS NOT NULL AND bottle_cost_p IS NOT NULL)
    OR unit_cost_p IS NOT NULL
  )
);

CREATE INDEX idx_pouriq_lib_trade_account ON pouriq_ingredients_library(trade_account_id);
CREATE UNIQUE INDEX idx_pouriq_lib_uniqueness
  ON pouriq_ingredients_library(trade_account_id, LOWER(name), COALESCE(bottle_size_ml, -1));

-- 2. Add the new columns to pouriq_ingredients (nullable for now)
ALTER TABLE pouriq_ingredients ADD COLUMN library_ingredient_id TEXT REFERENCES pouriq_ingredients_library(id);
ALTER TABLE pouriq_ingredients ADD COLUMN unit_count REAL;

-- 3. Backfill: create one library entry per unique (tenant, lower(name), bottle_size_ml)
INSERT INTO pouriq_ingredients_library (
  trade_account_id, name, ingredient_type, bottle_size_ml, bottle_cost_p, unit_cost_p
)
SELECT
  m.trade_account_id,
  i.name,
  i.ingredient_type,
  i.bottle_size_ml,
  i.bottle_cost_p,
  i.unit_cost_p
FROM pouriq_ingredients i
JOIN pouriq_cocktails c ON c.id = i.cocktail_id
JOIN pouriq_menus m ON m.id = c.menu_id
GROUP BY m.trade_account_id, LOWER(i.name), COALESCE(i.bottle_size_ml, -1);

-- 4. Link existing pouriq_ingredients rows to their library entries
UPDATE pouriq_ingredients
SET library_ingredient_id = (
  SELECT l.id
  FROM pouriq_ingredients_library l
  JOIN pouriq_cocktails c ON c.id = pouriq_ingredients.cocktail_id
  JOIN pouriq_menus m ON m.id = c.menu_id
  WHERE l.trade_account_id = m.trade_account_id
    AND LOWER(l.name) = LOWER(pouriq_ingredients.name)
    AND COALESCE(l.bottle_size_ml, -1) = COALESCE(pouriq_ingredients.bottle_size_ml, -1)
);

-- 5. Set unit_count = 1.0 for rows that were unit-priced (had unit_cost_p)
UPDATE pouriq_ingredients
SET unit_count = 1.0
WHERE unit_cost_p IS NOT NULL;

-- 6-7. Rebuild pouriq_ingredients to drop old columns and add NOT NULL on library_ingredient_id
-- (SQLite can't ALTER COLUMN to add NOT NULL directly, and sequential DROP COLUMN
-- operations can fail in miniflare, so we do a single table rebuild)
CREATE TABLE pouriq_ingredients_new (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  cocktail_id           TEXT NOT NULL REFERENCES pouriq_cocktails(id) ON DELETE CASCADE,
  library_ingredient_id TEXT NOT NULL REFERENCES pouriq_ingredients_library(id),
  pour_ml               REAL,
  unit_count            REAL,
  CHECK (pour_ml IS NOT NULL OR unit_count IS NOT NULL)
);

INSERT INTO pouriq_ingredients_new (id, cocktail_id, library_ingredient_id, pour_ml, unit_count)
SELECT id, cocktail_id, library_ingredient_id, pour_ml, unit_count FROM pouriq_ingredients;

DROP TABLE pouriq_ingredients;
ALTER TABLE pouriq_ingredients_new RENAME TO pouriq_ingredients;

CREATE INDEX idx_pouriq_ingredients_cocktail ON pouriq_ingredients(cocktail_id);
CREATE INDEX idx_pouriq_ingredients_library ON pouriq_ingredients(library_ingredient_id);
