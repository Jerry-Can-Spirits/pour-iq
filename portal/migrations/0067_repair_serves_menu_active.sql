-- Repair: the serves menu must never be the active real menu.
-- A prior bug promoted the serves-menu row to is_active=1 during initial setup.
-- getActiveMenu now excludes serves menus (is_serves_menu = 1), so any venue
-- hit by the old bug would appear paused (no active menu found).
-- This migration is always safe: the serves menu is an internal staging area
-- and must never be the current menu surfaced to the live menu view.
UPDATE pouriq_menus SET is_active = 0 WHERE is_serves_menu = 1;
