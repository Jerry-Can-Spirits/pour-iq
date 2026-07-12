-- Fix a foreign-key typo that made saving a voice profile or committing an
-- invoice impossible in production.
--
-- pouriq_voice_profiles (migration 0027) and pouriq_invoices (migration 0025)
-- both declared `trade_account_id ... REFERENCES pouriq_trade_accounts(id)`.
-- That table does not exist — the real table is `trade_accounts`. With D1's
-- foreign-key enforcement ON, every INSERT into these tables fails the FK
-- check, returning a 500. Both tables are empty globally (no row has ever
-- been saved), so we can drop and recreate them with the correct reference;
-- there is no data to preserve.
--
-- SQLite cannot alter a column's foreign key, so a table rebuild is required.
-- Child tables (pouriq_invoice_lines, pouriq_cost_changes) have CORRECT keys
-- and are left untouched: pouriq_invoices is recreated under the same name so
-- their references resolve again, and they hold no rows that reference an
-- invoice (no invoice has ever existed).

DROP TABLE IF EXISTS pouriq_voice_profiles;
CREATE TABLE pouriq_voice_profiles (
  trade_account_id TEXT PRIMARY KEY REFERENCES trade_accounts(id) ON DELETE CASCADE,
  tone TEXT NOT NULL,
  tone_other TEXT NULL,
  person TEXT NOT NULL,
  length TEXT NOT NULL,
  rules_json TEXT NOT NULL DEFAULT '[]',
  samples_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

DROP TABLE IF EXISTS pouriq_invoices;
CREATE TABLE pouriq_invoices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trade_account_id TEXT NOT NULL REFERENCES trade_accounts(id) ON DELETE CASCADE,
  supplier_name TEXT,
  invoice_number TEXT,
  invoice_date TEXT,
  net_total_p INTEGER,
  line_count INTEGER NOT NULL,
  applied_line_count INTEGER NOT NULL,
  r2_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
