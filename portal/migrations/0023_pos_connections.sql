-- Per-tenant OAuth connection to a POS provider. One row per
-- (trade_account_id, provider) pair so a venue can connect Square AND
-- Lightspeed without conflict. Tokens stored in plain text — D1 is
-- already encrypted at rest at Cloudflare's storage layer; client-side
-- encryption would add no security against an attacker with D1 read
-- access (same boundary as PINs already in trade_accounts) and would
-- complicate the refresh-token flow.

CREATE TABLE pouriq_pos_connections (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trade_account_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('square', 'eposnow', 'lightspeed', 'toast')),
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
CREATE UNIQUE INDEX uniq_pos_connection_per_provider
  ON pouriq_pos_connections(trade_account_id, provider);

-- OAuth state nonce store. Brief-lived (10min TTL), prevents CSRF on
-- the OAuth callback. Could live in KV instead; keeping in D1 for
-- consistency and to avoid yet another KV namespace.
CREATE TABLE pouriq_pos_oauth_states (
  state TEXT PRIMARY KEY,
  trade_account_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
