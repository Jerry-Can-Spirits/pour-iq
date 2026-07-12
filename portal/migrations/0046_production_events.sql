-- Slice 3 Part B: production events. Making a batch of a prepared ingredient
-- consumes its components and produces prepared on-hand. Snapshot at production
-- time so later recipe edits never rewrite history. Additive.
CREATE TABLE pouriq_production_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trade_account_id TEXT NOT NULL,
  prepared_ingredient_id TEXT NOT NULL REFERENCES pouriq_ingredients_library(id) ON DELETE CASCADE,
  batches REAL NOT NULL CHECK (batches > 0),
  yield_base_produced REAL NOT NULL,
  produced_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_production_events_tenant ON pouriq_production_events (trade_account_id, prepared_ingredient_id, produced_at);

CREATE TABLE pouriq_production_components (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  production_event_id TEXT NOT NULL REFERENCES pouriq_production_events(id) ON DELETE CASCADE,
  component_ingredient_id TEXT NOT NULL REFERENCES pouriq_ingredients_library(id) ON DELETE RESTRICT,
  amount_base_consumed REAL NOT NULL,
  produced_at TEXT NOT NULL
);
CREATE INDEX idx_production_components_component ON pouriq_production_components (component_ingredient_id, produced_at);
