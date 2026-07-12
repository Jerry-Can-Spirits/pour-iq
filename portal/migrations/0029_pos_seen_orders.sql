-- Order-level deduplication for POS ingestion.
-- The hourly cron re-fetches a one-hour overlap window and webhooks can
-- deliver the same order the cron later fetches; without this table the
-- additive volume upsert double-counts those orders.
CREATE TABLE IF NOT EXISTS pouriq_pos_seen_orders (
  connection_id TEXT NOT NULL,
  external_order_id TEXT NOT NULL,
  seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (connection_id, external_order_id)
);
