import type { ItemType } from './types'

const SECTION_NAME: Record<ItemType, string> = {
  cocktail: 'Cocktails', beer: 'Beer & Cider', cider: 'Beer & Cider', wine: 'Wine',
  spirit: 'Spirits', 'soft-drink': 'Soft Drinks', food: 'Food', other: 'Other',
}
// Canonical display order of seeded sections.
const ORDER = ['Cocktails', 'Beer & Cider', 'Wine', 'Spirits', 'Soft Drinks', 'Food', 'Other']

export function itemTypeToSectionName(t: ItemType): string {
  return SECTION_NAME[t]
}

export function planSeededSections(
  drinks: { id: string; item_type: ItemType }[],
): { sections: { tempId: string; name: string }[]; assignments: { cocktailId: string; tempId: string }[] } {
  const byName = new Map<string, string[]>() // name -> cocktail ids
  for (const d of drinks) {
    const name = itemTypeToSectionName(d.item_type)
    const list = byName.get(name) ?? []
    list.push(d.id)
    byName.set(name, list)
  }
  const names = [...byName.keys()].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
  const sections = names.map((name) => ({ tempId: `seed:${name}`, name }))
  const assignments = sections.flatMap((s) =>
    (byName.get(s.name) ?? []).map((cocktailId) => ({ cocktailId, tempId: s.tempId })),
  )
  return { sections, assignments }
}

export function resequence(ids: string[]): { id: string; position: number }[] {
  return ids.map((id, position) => ({ id, position }))
}

// Plan a deep copy of a menu's sections into a new menu. Assigns a fresh id to
// every source section, orders top sections before sub-sections (so the
// self-referential parent FK is satisfied on sequential insert), and remaps
// each sub-section's parent to its new id. `newId` supplies fresh ids (injected
// so it is testable). Returns the ordered inserts plus the old->new id map so
// the caller can re-point cloned cocktails at their new sections.
export function planSectionClone(
  source: { id: string; name: string; parent_section_id: string | null; position: number }[],
  newId: () => string,
): {
  inserts: { id: string; name: string; parent_section_id: string | null; position: number }[]
  idMap: Map<string, string>
} {
  const idMap = new Map<string, string>()
  for (const s of source) idMap.set(s.id, newId())
  const ordered = [
    ...source.filter((s) => s.parent_section_id === null),
    ...source.filter((s) => s.parent_section_id !== null),
  ]
  const inserts = ordered.map((s) => ({
    id: idMap.get(s.id)!,
    name: s.name,
    parent_section_id: s.parent_section_id === null ? null : (idMap.get(s.parent_section_id) ?? null),
    position: s.position,
  }))
  return { inserts, idMap }
}
