-- Add a coarse item_type to menu drinks; backfill single-ingredient drinks
-- from their one ingredient's type. Multi/zero-ingredient drinks stay 'cocktail'.
ALTER TABLE pouriq_cocktails ADD COLUMN item_type TEXT NOT NULL DEFAULT 'cocktail';

UPDATE pouriq_cocktails
SET item_type = (
  SELECT CASE il.ingredient_type
    WHEN 'beer' THEN 'beer' WHEN 'cider' THEN 'cider' WHEN 'wine' THEN 'wine'
    WHEN 'spirit' THEN 'spirit' WHEN 'liqueur' THEN 'spirit'
    WHEN 'soft-drink' THEN 'soft-drink' WHEN 'alcohol-free' THEN 'soft-drink'
    WHEN 'mixer' THEN 'soft-drink' WHEN 'juice' THEN 'soft-drink'
    WHEN 'food' THEN 'food' ELSE 'other' END
  FROM pouriq_ingredients i
  JOIN pouriq_ingredients_library il ON il.id = i.library_ingredient_id
  WHERE i.cocktail_id = pouriq_cocktails.id
)
WHERE (SELECT COUNT(*) FROM pouriq_ingredients WHERE cocktail_id = pouriq_cocktails.id) = 1;
