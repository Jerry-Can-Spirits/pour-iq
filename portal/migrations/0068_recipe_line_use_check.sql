-- Widen the recipe-line CHECK so produce "use" lines are allowed.
-- A recipe line measured by a fresh-produce use stores its quantity as
-- use_id + recipe_qty and leaves both pour_ml and unit_count NULL.
-- Migration 0016 defined CHECK (pour_ml IS NOT NULL OR unit_count IS NOT NULL);
-- migration 0064 added the use_id column but never updated that CHECK, so every
-- cocktail save using a produce use was rejected with SQLITE_CONSTRAINT_CHECK.
-- SQLite cannot ALTER a CHECK, so rebuild the table (create / copy / drop /
-- rename), preserving every column and both indexes. Same pattern as 0033.

CREATE TABLE pouriq_ingredients_new (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  cocktail_id           TEXT NOT NULL REFERENCES pouriq_cocktails(id) ON DELETE CASCADE,
  library_ingredient_id TEXT NOT NULL REFERENCES pouriq_ingredients_library(id),
  pour_ml               REAL,
  unit_count            REAL,
  recipe_unit           TEXT,
  recipe_qty            REAL,
  use_id                TEXT REFERENCES pouriq_ingredient_uses(id) ON DELETE SET NULL,
  CHECK (pour_ml IS NOT NULL OR unit_count IS NOT NULL OR use_id IS NOT NULL)
);

INSERT INTO pouriq_ingredients_new
  (id, cocktail_id, library_ingredient_id, pour_ml, unit_count, recipe_unit, recipe_qty, use_id)
SELECT
  id, cocktail_id, library_ingredient_id, pour_ml, unit_count, recipe_unit, recipe_qty, use_id
FROM pouriq_ingredients;

DROP TABLE pouriq_ingredients;

ALTER TABLE pouriq_ingredients_new RENAME TO pouriq_ingredients;

CREATE INDEX idx_pouriq_ingredients_cocktail ON pouriq_ingredients(cocktail_id);
CREATE INDEX idx_pouriq_ingredients_library ON pouriq_ingredients(library_ingredient_id);
