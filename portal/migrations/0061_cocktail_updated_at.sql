-- Add updated_at to pouriq_cocktails so photo cache-busting has a reliable version signal.
-- SQLite forbids a non-constant default (e.g. datetime('now')) on ALTER TABLE ADD COLUMN,
-- so add the column with a constant placeholder default and backfill existing rows.
-- New rows set updated_at explicitly in insertCocktail; every cocktail write updates it.
ALTER TABLE pouriq_cocktails ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
UPDATE pouriq_cocktails SET updated_at = datetime('now');
