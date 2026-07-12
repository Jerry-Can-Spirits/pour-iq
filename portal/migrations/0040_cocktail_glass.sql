-- Glassware for spec cards. Nullable; applies to cocktails and serves
-- (both live in pouriq_cocktails).
ALTER TABLE pouriq_cocktails ADD COLUMN glass TEXT;
