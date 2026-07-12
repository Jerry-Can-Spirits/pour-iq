-- 0027_pouriq_brand_voice.sql
-- Adds brand-voiced description support:
--   1. Two nullable columns on pouriq_cocktails for the saved description.
--   2. New table pouriq_voice_profiles (one row per trade account).

ALTER TABLE pouriq_cocktails ADD COLUMN description TEXT NULL;
ALTER TABLE pouriq_cocktails ADD COLUMN description_updated_at TEXT NULL;

CREATE TABLE pouriq_voice_profiles (
  trade_account_id TEXT PRIMARY KEY REFERENCES pouriq_trade_accounts(id) ON DELETE CASCADE,
  tone TEXT NOT NULL,                              -- 'refined' | 'casual' | 'cheeky' | 'classic' | 'minimal' | 'other'
  tone_other TEXT NULL,                            -- populated when tone = 'other'
  person TEXT NOT NULL,                            -- 'we' | 'i' | 'you' | 'third'
  length TEXT NOT NULL,                            -- 'short' | 'medium' | 'long'
  rules_json TEXT NOT NULL DEFAULT '[]',           -- JSON string[] of selected hard rules + free-text additions
  samples_json TEXT NOT NULL DEFAULT '[]',         -- JSON string[] of 1-3 sample paragraphs
  notes TEXT NOT NULL DEFAULT '',                  -- free-text "anything else"
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
