-- 0026_pouriq_stock_counts.sql
-- Per-menu, per-ingredient, per-period stock count for variance tracking.
-- One row per (menu, library_ingredient, period). UPSERT on save.

CREATE TABLE pouriq_stock_counts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  menu_id TEXT NOT NULL REFERENCES pouriq_menus(id) ON DELETE CASCADE,
  library_ingredient_id TEXT NOT NULL REFERENCES pouriq_ingredients_library(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,        -- ISO YYYY-MM-DD; matches pouriq_drink_volumes shape
  period_end TEXT NOT NULL,          -- ISO YYYY-MM-DD
  start_count REAL NOT NULL,         -- bottles at start of period (3.5 = three-and-a-half bottles)
  end_count REAL NOT NULL,           -- bottles at end of period
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX uniq_pouriq_stock_counts
  ON pouriq_stock_counts(menu_id, library_ingredient_id, period_start, period_end);

CREATE INDEX idx_pouriq_stock_counts_menu_period
  ON pouriq_stock_counts(menu_id, period_start, period_end);
