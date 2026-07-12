CREATE TABLE pouriq_ingredient_uses (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  ingredient_id TEXT NOT NULL REFERENCES pouriq_ingredients_library(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  recipe_unit TEXT NOT NULL,
  yield_qty REAL NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_pouriq_ingredient_uses_ingredient ON pouriq_ingredient_uses(ingredient_id);
ALTER TABLE pouriq_ingredients ADD COLUMN use_id TEXT REFERENCES pouriq_ingredient_uses(id) ON DELETE SET NULL;
