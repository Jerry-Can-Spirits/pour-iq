-- Serve mapping: a "serve" is a cocktail row (is_serve=1) on a hidden per-tenant
-- "Bar serves" menu (is_serves_menu=1). Both additive, default 0 = no change to
-- existing rows.
ALTER TABLE pouriq_cocktails ADD COLUMN is_serve INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pouriq_menus ADD COLUMN is_serves_menu INTEGER NOT NULL DEFAULT 0;
