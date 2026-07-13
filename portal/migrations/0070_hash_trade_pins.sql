-- Hashed trade PINs. The pin column now stores 'pin:v1:...' PBKDF2
-- strings (written by the hourly credential sweep and the login upgrade
-- path); pin_lookup is the deterministic peppered HMAC used for login
-- SELECTs, since a salted hash cannot be queried. Plaintext rows remain
-- only until the first sweep after PIN_PEPPER is set, or their next
-- successful login, whichever comes first.
ALTER TABLE trade_accounts ADD COLUMN pin_lookup TEXT;
CREATE UNIQUE INDEX idx_trade_accounts_pin_lookup ON trade_accounts (pin_lookup);
