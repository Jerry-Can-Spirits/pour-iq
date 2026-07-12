-- Slice 2: recipe units. Per-ingredient serve units + recipe lines expressed in
-- a unit + qty (display/entry) while pour_ml/unit_count remain the base amount.
CREATE TABLE pouriq_ingredient_serve_units (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  library_ingredient_id TEXT NOT NULL REFERENCES pouriq_ingredients_library(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_per_unit REAL NOT NULL CHECK (base_per_unit > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_serve_units_ingredient ON pouriq_ingredient_serve_units (library_ingredient_id);
CREATE UNIQUE INDEX uniq_serve_unit_name ON pouriq_ingredient_serve_units (library_ingredient_id, name);

ALTER TABLE pouriq_ingredients ADD COLUMN recipe_unit TEXT;
ALTER TABLE pouriq_ingredients ADD COLUMN recipe_qty REAL;

-- Backfill existing lines so spec cards keep rendering: qty = the base amount,
-- unit = 'item' for unit-priced lines else the ingredient's base unit.
UPDATE pouriq_ingredients
SET recipe_qty = COALESCE(pour_ml, unit_count),
    recipe_unit = CASE
      WHEN unit_count IS NOT NULL THEN 'item'
      ELSE (SELECT base_unit FROM pouriq_ingredients_library lib WHERE lib.id = pouriq_ingredients.library_ingredient_id)
    END
WHERE recipe_unit IS NULL;
