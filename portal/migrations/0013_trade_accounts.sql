-- Trade accounts: PIN-gated access for approved trade customers
-- Each row is one venue with their PIN, tier, and discount code.
-- Apply with: npx wrangler d1 execute jerry-can-spirits-db --remote --file=migrations/0013_trade_accounts.sql

CREATE TABLE IF NOT EXISTS trade_accounts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  pin TEXT NOT NULL UNIQUE,
  discount_code TEXT NOT NULL,
  tier TEXT NOT NULL CHECK(tier IN ('intro', 'standard', 'partner')),
  venue_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
