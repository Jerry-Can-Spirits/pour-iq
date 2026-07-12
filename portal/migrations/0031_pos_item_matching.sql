-- Persistent till-name → cocktail mappings (and ignores), per tenant.
-- Lets venues correct POS items the fuzzy matcher missed; ignored rows
-- suppress non-cocktail till buttons (food, service charge) from review.
CREATE TABLE IF NOT EXISTS pouriq_pos_item_map (
  trade_account_id TEXT NOT NULL,
  normalised_pos_name TEXT NOT NULL,
  cocktail_id TEXT,            -- null when ignored = 1
  cocktail_name TEXT,          -- normalised; resolves across menu changes by name
  ignored INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (trade_account_id, normalised_pos_name)
);

-- Bounded log of unmatched sale lines, for review + backfill. Pruned > 90 days.
CREATE TABLE IF NOT EXISTS pouriq_pos_unmatched_lines (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  connection_id TEXT NOT NULL,
  trade_account_id TEXT NOT NULL,
  normalised_name TEXT NOT NULL,
  raw_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  sold_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_unmatched_tenant_name
  ON pouriq_pos_unmatched_lines (trade_account_id, normalised_name);
