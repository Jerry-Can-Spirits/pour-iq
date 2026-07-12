-- Unified purchase-basis pricing: purchase_qty is how many items the stored
-- price (bottle_cost_p / unit_cost_p) covers — 1 bottle, a case of 24, 6 lemons,
-- one 10L BIB. Per-item / per-ml cost = price / purchase_qty. Additive and
-- backward-compatible: default 1 means every existing row is unchanged.
ALTER TABLE pouriq_ingredients_library ADD COLUMN purchase_qty INTEGER NOT NULL DEFAULT 1;
