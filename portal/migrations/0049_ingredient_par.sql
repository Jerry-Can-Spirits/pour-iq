-- Par level (in bottles/packs) per ml ingredient, for low-stock flagging and
-- reorder suggestions. Nullable: NULL = no par set / not tracked for reorder.
-- Additive, no backfill.
ALTER TABLE pouriq_ingredients_library ADD COLUMN par_bottles REAL;
