-- Cost-side VAT basis. price_p is now always stored NET of VAT; these columns
-- remember how the user entered it. See spec
-- docs/superpowers/specs/2026-06-26-pouriq-cost-vat-basis-design.md.
--   price_includes_vat: 0 = entered net/ex VAT; 1 = entered inc VAT (stored net).
--   price_entered_p:    the exact pence the user typed (gross when inc), for
--                       penny-exact re-edit and accountant-facing audit.
-- Additive; the table CHECK references only base_unit/pack_size/price_p so a
-- plain ADD COLUMN is safe. Existing rows: flag defaults 0 (behaviour unchanged)
-- and price_entered_p is backfilled to the current (net-treated) price_p.
ALTER TABLE pouriq_ingredients_library
  ADD COLUMN price_includes_vat INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pouriq_ingredients_library
  ADD COLUMN price_entered_p INTEGER;
UPDATE pouriq_ingredients_library
  SET price_entered_p = price_p WHERE price_entered_p IS NULL;
