-- Pour IQ: AI menu margin optimisation tool.
-- Five tables: subscriptions (access), menus, cocktails, ingredients, analyses.
-- Apply with:
--   wrangler d1 execute jerry-can-spirits-db --local --file=migrations/0015_pouriq.sql
--   wrangler d1 execute jerry-can-spirits-db --remote --file=migrations/0015_pouriq.sql

CREATE TABLE IF NOT EXISTS pouriq_subscriptions (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trade_account_id TEXT NOT NULL REFERENCES trade_accounts(id),
  licence_type     TEXT NOT NULL CHECK(licence_type IN ('pilot','annual','biannual','monthly')),
  valid_from       TEXT NOT NULL DEFAULT (datetime('now')),
  valid_until      TEXT NOT NULL,
  price_paid_p     INTEGER NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pouriq_subscriptions_trade_account
  ON pouriq_subscriptions(trade_account_id);
CREATE INDEX IF NOT EXISTS idx_pouriq_subscriptions_valid_until
  ON pouriq_subscriptions(valid_until);

CREATE TABLE IF NOT EXISTS pouriq_menus (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trade_account_id TEXT NOT NULL REFERENCES trade_accounts(id),
  name             TEXT NOT NULL,
  venue_type       TEXT,
  city             TEXT,
  target_gp_pct    REAL NOT NULL DEFAULT 75.0,
  positioning      TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pouriq_menus_trade_account
  ON pouriq_menus(trade_account_id);

CREATE TABLE IF NOT EXISTS pouriq_cocktails (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  menu_id           TEXT NOT NULL REFERENCES pouriq_menus(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  sale_price_p      INTEGER NOT NULL,
  position          INTEGER NOT NULL DEFAULT 0,
  field_manual_slug TEXT,
  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_pouriq_cocktails_menu
  ON pouriq_cocktails(menu_id);
CREATE INDEX IF NOT EXISTS idx_pouriq_cocktails_field_man
  ON pouriq_cocktails(field_manual_slug);

CREATE TABLE IF NOT EXISTS pouriq_ingredients (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  cocktail_id     TEXT NOT NULL REFERENCES pouriq_cocktails(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  ingredient_type TEXT NOT NULL CHECK(ingredient_type IN ('spirit','liqueur','wine','beer','mixer','syrup','juice','garnish','other')),
  pour_ml         REAL,
  bottle_size_ml  REAL,
  bottle_cost_p   INTEGER,
  unit_cost_p     INTEGER,
  CHECK (
    (bottle_size_ml IS NOT NULL AND bottle_cost_p IS NOT NULL AND pour_ml IS NOT NULL)
    OR unit_cost_p IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_pouriq_ingredients_cocktail
  ON pouriq_ingredients(cocktail_id);

CREATE TABLE IF NOT EXISTS pouriq_analyses (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  menu_id              TEXT NOT NULL REFERENCES pouriq_menus(id) ON DELETE CASCADE,
  model                TEXT NOT NULL,
  prompt_tokens        INTEGER,
  output_tokens        INTEGER,
  recommendations_json TEXT NOT NULL,
  metrics_json         TEXT NOT NULL,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pouriq_analyses_menu
  ON pouriq_analyses(menu_id);
