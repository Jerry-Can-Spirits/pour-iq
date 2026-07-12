ALTER TABLE pouriq_menus ADD COLUMN theme TEXT NOT NULL DEFAULT 'clean';
ALTER TABLE pouriq_menus ADD COLUMN logo_r2_key TEXT;
ALTER TABLE pouriq_menus ADD COLUMN logo_align TEXT NOT NULL DEFAULT 'center';
ALTER TABLE pouriq_cocktails ADD COLUMN photo_r2_key TEXT;
