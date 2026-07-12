-- Shared barcode catalogue across all Pour IQ tenants.
--
-- Spirits, beers and wines have global barcodes — Smirnoff Red 700ml is
-- the same EAN-13 in every UK bar. If one tenant has already saved a
-- library entry with that code, subsequent tenants scanning the same
-- bottle should auto-prefill name, ingredient_type and bottle_size_ml,
-- so they only need to enter their own cost.
--
-- The catalogue stores ONLY product attributes. No costs, no tenant
-- data, no PII. The first_contributor_account_id is internal audit
-- only and is never exposed via the API.

CREATE TABLE pouriq_barcode_catalogue (
  barcode TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ingredient_type TEXT NOT NULL,
  bottle_size_ml INTEGER,
  contributor_count INTEGER NOT NULL DEFAULT 1,
  verified INTEGER NOT NULL DEFAULT 0,
  first_contributor_account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
