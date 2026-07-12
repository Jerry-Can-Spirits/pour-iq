-- 0050 widened the provider CHECK by rebuilding pouriq_pos_connections from an
-- explicit column list, but that list omitted auth_mode (added by 0030), so
-- applying 0050 silently dropped the column. The OAuth callback's upsert writes
-- auth_mode, so connecting any provider then failed with:
--   D1_ERROR: table pouriq_pos_connections has no column named auth_mode
-- Restore it. Additive, identical to 0030. (target_menu_id was also dropped by
-- 0050 but that was intentional, retired by 0032's menu is_active routing.)
ALTER TABLE pouriq_pos_connections ADD COLUMN auth_mode TEXT NOT NULL DEFAULT 'oauth';
