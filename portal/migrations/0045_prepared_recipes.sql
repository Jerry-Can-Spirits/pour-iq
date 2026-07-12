-- Slice 3 (costing): prepared/in-house ingredients. is_prepared flags a library
-- row whose price_p (= batch cost) and pack_size (= yield) are DERIVED from its
-- components rather than typed in. Additive: default 0 = all existing are purchased.
ALTER TABLE pouriq_ingredients_library ADD COLUMN is_prepared INTEGER NOT NULL DEFAULT 0;

CREATE TABLE pouriq_prepared_components (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  prepared_ingredient_id TEXT NOT NULL REFERENCES pouriq_ingredients_library(id) ON DELETE CASCADE,
  component_ingredient_id TEXT NOT NULL REFERENCES pouriq_ingredients_library(id) ON DELETE RESTRICT,
  amount_base REAL NOT NULL CHECK (amount_base > 0),
  recipe_unit TEXT,
  recipe_qty REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_prepared_components_parent ON pouriq_prepared_components (prepared_ingredient_id);
CREATE INDEX idx_prepared_components_child ON pouriq_prepared_components (component_ingredient_id);
