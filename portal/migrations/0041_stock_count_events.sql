-- Variance v2: rolling, whole-bar stock counts. One append-only row per count
-- of an ingredient. Variance pairs the two most recent counts per ingredient.
-- Supersedes pouriq_stock_counts (left in place, no longer written/read).
CREATE TABLE pouriq_stock_count_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trade_account_id TEXT NOT NULL,
  library_ingredient_id TEXT NOT NULL REFERENCES pouriq_ingredients_library(id) ON DELETE CASCADE,
  counted_at TEXT NOT NULL,           -- ISO timestamp (datetime('now') granularity)
  count_qty REAL NOT NULL,            -- bottles of that item (3.5 = three and a half)
  reason TEXT,                        -- nullable; over-pour/spillage/comps/breakage/theft/unknown
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_stock_count_events_lookup
  ON pouriq_stock_count_events (trade_account_id, library_ingredient_id, counted_at);
