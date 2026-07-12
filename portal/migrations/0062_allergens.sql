ALTER TABLE pouriq_ingredients_library ADD COLUMN allergens TEXT NOT NULL DEFAULT '[]';
ALTER TABLE pouriq_ingredients_library ADD COLUMN dietary TEXT NOT NULL DEFAULT '[]';
ALTER TABLE pouriq_ingredients_library ADD COLUMN allergens_reviewed INTEGER NOT NULL DEFAULT 0;
