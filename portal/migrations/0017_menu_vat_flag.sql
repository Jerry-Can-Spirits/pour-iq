-- Add VAT-mode flag to pouriq_menus.
-- prices_include_vat = 1 (default): sale prices are inc-VAT (customer-facing).
--   GP% calculations divide sale by 1.20 to get net revenue before margin.
-- prices_include_vat = 0: sale prices are net of VAT (internal margin tracking).
--   GP% calculations use sale price as-is.

ALTER TABLE pouriq_menus ADD COLUMN prices_include_vat INTEGER NOT NULL DEFAULT 1;
