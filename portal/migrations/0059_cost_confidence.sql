ALTER TABLE pouriq_ingredients_library ADD COLUMN cost_confidence TEXT NOT NULL DEFAULT 'estimated';
UPDATE pouriq_ingredients_library SET cost_confidence = CASE WHEN price_p > 0 THEN 'set' ELSE 'estimated' END;
