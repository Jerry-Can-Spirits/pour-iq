-- Explicit single active menu per tenant — the live menu POS sales route to.
-- Replaces per-connection pouriq_pos_connections.target_menu_id routing
-- (that column is left in place but deprecated/unused).
ALTER TABLE pouriq_menus ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0;

-- Default: each tenant's oldest menu becomes active.
UPDATE pouriq_menus SET is_active = 1
WHERE id IN (
  SELECT id FROM pouriq_menus m
  WHERE m.created_at = (SELECT MIN(created_at) FROM pouriq_menus WHERE trade_account_id = m.trade_account_id)
);

-- Prefer the POS-routed menu where one exists: clear the tenant's flags, then
-- set the connection's target menu active so existing routing carries over.
UPDATE pouriq_menus SET is_active = 0
WHERE trade_account_id IN (SELECT trade_account_id FROM pouriq_pos_connections WHERE target_menu_id IS NOT NULL);
UPDATE pouriq_menus SET is_active = 1
WHERE id IN (
  SELECT target_menu_id FROM pouriq_pos_connections
  WHERE target_menu_id IS NOT NULL GROUP BY trade_account_id
);
