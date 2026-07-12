-- Widen the POS provider CHECK to match the providers the app actually
-- supports. zettle, sumup and tevalis were added in code (PosProvider in
-- src/lib/pouriq/pos/types.ts) but the constraint from 0023 was never updated,
-- so the OAuth callback's INSERT failed with:
--   CHECK constraint failed: provider IN ('square','eposnow','lightspeed','toast')
-- which surfaced as "could not complete the connection" when connecting SumUp.
-- SQLite cannot ALTER a CHECK constraint, so rebuild the table preserving data
-- and the unique index. No other table has a foreign key to this one.

CREATE TABLE pouriq_pos_connections_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trade_account_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('square', 'zettle', 'sumup', 'tevalis', 'eposnow', 'lightspeed', 'toast')),
  external_account_id TEXT NOT NULL,
  external_location_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TEXT,
  scopes TEXT,
  last_synced_at TEXT,
  last_sync_error TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO pouriq_pos_connections_new
  SELECT id, trade_account_id, provider, external_account_id, external_location_id,
         access_token, refresh_token, token_expires_at, scopes, last_synced_at,
         last_sync_error, enabled, created_at, updated_at
  FROM pouriq_pos_connections;

DROP TABLE pouriq_pos_connections;
ALTER TABLE pouriq_pos_connections_new RENAME TO pouriq_pos_connections;

CREATE UNIQUE INDEX uniq_pos_connection_per_provider
  ON pouriq_pos_connections(trade_account_id, provider);
