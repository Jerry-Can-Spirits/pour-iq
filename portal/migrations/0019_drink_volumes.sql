-- Per-drink sales volume by reporting period. Bar managers enter how many
-- of each drink sold this week/month so Pour IQ can compute margin
-- contribution (margin × units_sold) — the actual headline number for
-- "which drinks are pulling weight on this menu".
--
-- Scope fence: this table stores VOLUME ONLY. Revenue is derived from
-- volume × the cocktail's existing sale_price. We never store revenue,
-- COGS aggregates, labour, rent — Pour IQ stays drink-level margin
-- intelligence, not a P&L tool.

CREATE TABLE pouriq_drink_volumes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  cocktail_id TEXT NOT NULL REFERENCES pouriq_cocktails(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  units_sold INTEGER NOT NULL CHECK (units_sold >= 0),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'pos')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_pouriq_drink_volumes_cocktail
  ON pouriq_drink_volumes(cocktail_id);

CREATE UNIQUE INDEX uniq_pouriq_drink_volumes_period
  ON pouriq_drink_volumes(cocktail_id, period_start, period_end);

-- Per-menu reporting cadence. 'monthly' matches how most bar managers
-- think about their books; weekly is opt-in for venues with POS reports.
ALTER TABLE pouriq_menus
  ADD COLUMN volume_cadence TEXT NOT NULL DEFAULT 'monthly'
  CHECK (volume_cadence IN ('weekly', 'monthly'));
