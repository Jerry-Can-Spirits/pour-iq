import type { MenuSectionRow, ItemType } from './types'
import { planSeededSections, resequence, planSectionClone } from './menu-sections-plan'

export async function listSectionsForMenu(
  db: D1Database,
  menuId: string,
): Promise<MenuSectionRow[]> {
  const result = await db
    .prepare(`SELECT * FROM pouriq_menu_sections WHERE menu_id = ?1 ORDER BY position ASC`)
    .bind(menuId)
    .all<MenuSectionRow>()
  return result.results ?? []
}

// Seeds sections from item_type groupings when none exist yet.
// No-op if any section already exists for the menu.
export async function ensureSeededSections(db: D1Database, menuId: string): Promise<void> {
  const existing = await db
    .prepare(`SELECT COUNT(*) AS c FROM pouriq_menu_sections WHERE menu_id = ?1`)
    .bind(menuId)
    .first<{ c: number }>()
  if ((existing?.c ?? 0) > 0) return

  const drinksResult = await db
    .prepare(`SELECT id, item_type FROM pouriq_cocktails WHERE menu_id = ?1 AND is_serve = 0`)
    .bind(menuId)
    .all<{ id: string; item_type: ItemType }>()
  const drinks = drinksResult.results ?? []
  const { sections, assignments } = planSeededSections(drinks)
  if (sections.length === 0) return

  const tempIdToActualId = new Map<string, string>()
  const seq = resequence(sections.map((s) => s.tempId))
  const statements: D1PreparedStatement[] = []

  for (const { id: tempId, position } of seq) {
    const section = sections.find((s) => s.tempId === tempId)!
    const id = crypto.randomUUID()
    tempIdToActualId.set(tempId, id)
    statements.push(
      db
        .prepare(`INSERT INTO pouriq_menu_sections (id, menu_id, name, parent_section_id, position) VALUES (?1, ?2, ?3, NULL, ?4)`)
        .bind(id, menuId, section.name, position),
    )
  }

  for (const { cocktailId, tempId } of assignments) {
    const sectionId = tempIdToActualId.get(tempId)
    if (sectionId) {
      statements.push(
        db
          .prepare(`UPDATE pouriq_cocktails SET section_id = ?1 WHERE id = ?2`)
          .bind(sectionId, cocktailId),
      )
    }
  }

  await db.batch(statements)
}

// Deep-copy a source menu's sections into a new menu. Returns a map from each
// source section id to its new id, so the caller can re-point cloned cocktails.
export async function cloneSections(
  db: D1Database,
  sourceMenuId: string,
  newMenuId: string,
): Promise<Map<string, string>> {
  const sections = await listSectionsForMenu(db, sourceMenuId)
  const { inserts, idMap } = planSectionClone(sections, () => crypto.randomUUID())
  if (inserts.length > 0) {
    await db.batch(
      inserts.map((s) =>
        db
          .prepare(`INSERT INTO pouriq_menu_sections (id, menu_id, name, parent_section_id, position) VALUES (?1, ?2, ?3, ?4, ?5)`)
          .bind(s.id, newMenuId, s.name, s.parent_section_id, s.position),
      ),
    )
  }
  return idMap
}

export async function createSection(
  db: D1Database,
  menuId: string,
  name: string,
  parentSectionId: string | null,
): Promise<string> {
  let position = 0
  if (parentSectionId === null) {
    const r = await db
      .prepare(`SELECT COUNT(*) AS c FROM pouriq_menu_sections WHERE menu_id = ?1 AND parent_section_id IS NULL`)
      .bind(menuId)
      .first<{ c: number }>()
    position = r?.c ?? 0
  } else {
    const r = await db
      .prepare(`SELECT COUNT(*) AS c FROM pouriq_menu_sections WHERE menu_id = ?1 AND parent_section_id = ?2`)
      .bind(menuId, parentSectionId)
      .first<{ c: number }>()
    position = r?.c ?? 0
  }
  const id = crypto.randomUUID()
  await db
    .prepare(`INSERT INTO pouriq_menu_sections (id, menu_id, name, parent_section_id, position) VALUES (?1, ?2, ?3, ?4, ?5)`)
    .bind(id, menuId, name, parentSectionId, position)
    .run()
  return id
}

export async function renameSection(db: D1Database, sectionId: string, name: string): Promise<void> {
  await db
    .prepare(`UPDATE pouriq_menu_sections SET name = ?1 WHERE id = ?2`)
    .bind(name, sectionId)
    .run()
}

// Explicitly NULLs section_id on affected drinks and deletes sub-sections
// before deleting the section — D1 has foreign keys off, so ON DELETE cascade/set-null
// is not enforced at runtime.
export async function deleteSection(db: D1Database, sectionId: string, menuId: string): Promise<void> {
  const subResult = await db
    .prepare(`SELECT id FROM pouriq_menu_sections WHERE parent_section_id = ?1 AND menu_id = ?2`)
    .bind(sectionId, menuId)
    .all<{ id: string }>()
  const subIds = (subResult.results ?? []).map((r) => r.id)

  const statements: D1PreparedStatement[] = [
    db.prepare(`UPDATE pouriq_cocktails SET section_id = NULL WHERE section_id = ?1`).bind(sectionId),
  ]
  for (const subId of subIds) {
    statements.push(
      db.prepare(`UPDATE pouriq_cocktails SET section_id = NULL WHERE section_id = ?1`).bind(subId),
    )
    statements.push(
      db.prepare(`DELETE FROM pouriq_menu_sections WHERE id = ?1`).bind(subId),
    )
  }
  statements.push(db.prepare(`DELETE FROM pouriq_menu_sections WHERE id = ?1`).bind(sectionId))

  await db.batch(statements)
}

// Resequences a sibling set; caller passes a single sibling scope (all top-level
// or all sub-sections of one parent).
export async function reorderSections(db: D1Database, orderedIds: string[]): Promise<void> {
  const updates = resequence(orderedIds)
  if (updates.length === 0) return
  await db.batch(
    updates.map(({ id, position }) =>
      db.prepare(`UPDATE pouriq_menu_sections SET position = ?1 WHERE id = ?2`).bind(position, id),
    ),
  )
}

export async function moveDrink(
  db: D1Database,
  cocktailId: string,
  sectionId: string | null,
  position: number,
): Promise<void> {
  await db
    .prepare(`UPDATE pouriq_cocktails SET section_id = ?1, position = ?2 WHERE id = ?3`)
    .bind(sectionId, position, cocktailId)
    .run()
}
