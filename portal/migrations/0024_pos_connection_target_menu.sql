-- Designate which menu's cocktails receive POS-driven volume updates
-- for a given connection. NULL means ingest is paused — the user must
-- pick an active menu in the integrations UI before sales start
-- flowing. Lets a venue swap seasonally (spring -> summer) and have
-- each menu's analytics reflect only its own live period.

ALTER TABLE pouriq_pos_connections
  ADD COLUMN target_menu_id TEXT REFERENCES pouriq_menus(id) ON DELETE SET NULL;
