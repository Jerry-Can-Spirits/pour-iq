CREATE TABLE IF NOT EXISTS pouriq_menu_sections (
  id                TEXT PRIMARY KEY,
  menu_id           TEXT NOT NULL REFERENCES pouriq_menus(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  parent_section_id TEXT REFERENCES pouriq_menu_sections(id) ON DELETE CASCADE,
  position          INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_menu_sections_menu ON pouriq_menu_sections(menu_id);

ALTER TABLE pouriq_cocktails ADD COLUMN section_id TEXT REFERENCES pouriq_menu_sections(id) ON DELETE SET NULL;
