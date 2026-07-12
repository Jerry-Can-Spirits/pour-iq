import type { CostConfidence, IngredientLibraryRow, IngredientType } from './types'
import { insertCostChange, type CostPricingMode } from './cost-changes'

export interface IngredientLibraryInsert {
  trade_account_id: string
  name: string
  ingredient_type: IngredientType
  base_unit: 'ml' | 'g' | 'each'
  pack_size: number
  price_p: number
  price_includes_vat?: number      // 0 = net/ex; 1 = inc (price_p already net)
  price_entered_p?: number | null  // exact entered pence (gross when inc)
  purchase_qty?: number   // defaults to 1
  yield_pct?: number
  pack_format?: string | null
  subcategory?: string | null
  barcode: string | null
  notes: string | null
  is_prepared?: boolean | number
  allergens?: string[]
  dietary?: string[]
  allergens_reviewed?: boolean
  abv?: number
}

// Columns present in the new schema (migration 0045 + 0059 + 0062 + 0063).
const LIBRARY_SELECT = `
  id, trade_account_id, name, ingredient_type,
  base_unit, pack_size, price_p, price_includes_vat, price_entered_p,
  pack_format, subcategory,
  is_prepared, purchase_qty, yield_pct, barcode, notes, cost_confidence, created_at, updated_at,
  allergens, dietary, allergens_reviewed, abv
`

function mapLibraryRow(r: {
  id: string
  trade_account_id: string
  name: string
  ingredient_type: IngredientType
  base_unit: 'ml' | 'g' | 'each'
  pack_size: number
  price_p: number
  price_includes_vat: number
  price_entered_p: number | null
  pack_format: string | null
  subcategory: string | null
  is_prepared: number
  purchase_qty: number
  yield_pct: number
  barcode: string | null
  notes: string | null
  cost_confidence: CostConfidence
  created_at: string
  updated_at: string
  allergens: string
  dietary: string
  allergens_reviewed: number
  abv: number
}): IngredientLibraryRow {
  return { ...r }
}

export interface IngredientLibraryUsage {
  id: string
  menu_id: string
  menu_name: string
  cocktail_id: string
  cocktail_name: string
}

export async function listLibraryEntries(
  db: D1Database,
  tradeAccountId: string,
): Promise<IngredientLibraryRow[]> {
  const result = await db
    .prepare(`
      SELECT ${LIBRARY_SELECT}
      FROM pouriq_ingredients_library
      WHERE trade_account_id = ?1
      ORDER BY LOWER(name) ASC
    `)
    .bind(tradeAccountId)
    .all<Parameters<typeof mapLibraryRow>[0]>()
  return (result.results ?? []).map(mapLibraryRow)
}

export async function getLibraryEntry(
  db: D1Database,
  id: string,
  tradeAccountId: string,
): Promise<IngredientLibraryRow | null> {
  const row = await db
    .prepare(`SELECT ${LIBRARY_SELECT} FROM pouriq_ingredients_library WHERE id = ?1 AND trade_account_id = ?2`)
    .bind(id, tradeAccountId)
    .first<Parameters<typeof mapLibraryRow>[0]>()
  return row ? mapLibraryRow(row) : null
}

export async function insertLibraryEntry(
  db: D1Database,
  data: IngredientLibraryInsert,
): Promise<string> {
  const isPrepared = data.is_prepared ? 1 : 0
  const confidence: CostConfidence = data.price_p > 0 ? 'set' : 'estimated'
  const result = await db
    .prepare(`
      INSERT INTO pouriq_ingredients_library
        (trade_account_id, name, ingredient_type, base_unit, pack_size, price_p, price_includes_vat, price_entered_p, purchase_qty, yield_pct, pack_format, subcategory, barcode, notes, is_prepared, cost_confidence, allergens, dietary, allergens_reviewed, abv)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
      RETURNING id
    `)
    .bind(
      data.trade_account_id, data.name, data.ingredient_type,
      data.base_unit, data.pack_size > 0 ? data.pack_size : 1, data.price_p,
      data.price_includes_vat ?? 0, data.price_entered_p ?? data.price_p,
      data.purchase_qty ?? 1, data.yield_pct ?? 100,
      data.pack_format ?? null, data.subcategory ?? null,
      data.barcode, data.notes, isPrepared, confidence,
      JSON.stringify(data.allergens ?? []),
      JSON.stringify(data.dietary ?? []),
      data.allergens_reviewed ? 1 : 0,
      data.abv ?? 0,
    )
    .first<{ id: string }>()
  if (!result) throw new Error('Library insert returned no id')
  return result.id
}

export async function findLibraryEntryByBarcode(
  db: D1Database,
  tradeAccountId: string,
  barcode: string,
): Promise<IngredientLibraryRow | null> {
  const row = await db
    .prepare(`SELECT ${LIBRARY_SELECT} FROM pouriq_ingredients_library WHERE trade_account_id = ?1 AND barcode = ?2`)
    .bind(tradeAccountId, barcode)
    .first<Parameters<typeof mapLibraryRow>[0]>()
  return row ? mapLibraryRow(row) : null
}

export async function updateLibraryEntry(
  db: D1Database,
  id: string,
  tradeAccountId: string,
  patch: Partial<Omit<IngredientLibraryInsert, 'trade_account_id'>>,
): Promise<void> {
  // Read current state for cost-change detection before mutating.
  const before = await getLibraryEntry(db, id, tradeAccountId)
  if (!before) return

  const newModelPatch: Record<string, unknown> = {}
  if ('name' in patch) newModelPatch['name'] = patch.name
  if ('ingredient_type' in patch) newModelPatch['ingredient_type'] = patch.ingredient_type
  if ('purchase_qty' in patch) newModelPatch['purchase_qty'] = patch.purchase_qty
  if ('barcode' in patch) newModelPatch['barcode'] = patch.barcode
  if ('notes' in patch) newModelPatch['notes'] = patch.notes
  if ('is_prepared' in patch) newModelPatch['is_prepared'] = patch.is_prepared ? 1 : 0

  const hasCostOrSize = 'base_unit' in patch || 'pack_size' in patch || 'price_p' in patch
  if (hasCostOrSize) {
    newModelPatch['base_unit'] = patch.base_unit ?? before.base_unit
    newModelPatch['pack_size'] = patch.pack_size != null && patch.pack_size > 0 ? patch.pack_size : before.pack_size
    newModelPatch['price_p'] = patch.price_p ?? before.price_p
    newModelPatch['cost_confidence'] = (patch.price_p ?? before.price_p) > 0 ? 'set' : 'estimated'
  }
  if ('price_includes_vat' in patch) newModelPatch['price_includes_vat'] = patch.price_includes_vat ?? 0
  if ('price_entered_p' in patch) newModelPatch['price_entered_p'] = patch.price_entered_p ?? newModelPatch['price_p'] ?? before.price_p
  if ('yield_pct' in patch) newModelPatch['yield_pct'] = patch.yield_pct ?? 100
  if ('pack_format' in patch) newModelPatch['pack_format'] = patch.pack_format ?? null
  if ('subcategory' in patch) newModelPatch['subcategory'] = patch.subcategory ?? null
  if ('allergens' in patch) newModelPatch['allergens'] = JSON.stringify(patch.allergens ?? [])
  if ('dietary' in patch) newModelPatch['dietary'] = JSON.stringify(patch.dietary ?? [])
  if ('allergens_reviewed' in patch) newModelPatch['allergens_reviewed'] = patch.allergens_reviewed ? 1 : 0
  if ('abv' in patch) newModelPatch['abv'] = patch.abv ?? 0

  const sets: string[] = []
  const binds: unknown[] = []
  let idx = 1
  for (const [key, val] of Object.entries(newModelPatch)) {
    sets.push(`${key} = ?${idx++}`)
    binds.push(val ?? null)
  }
  if (sets.length === 0) return
  sets.push(`updated_at = datetime('now')`)
  binds.push(id)
  binds.push(tradeAccountId)
  await db
    .prepare(`UPDATE pouriq_ingredients_library SET ${sets.join(', ')} WHERE id = ?${idx++} AND trade_account_id = ?${idx}`)
    .bind(...binds)
    .run()

  // Detect a cost change and log it.
  const newPriceP = hasCostOrSize ? (patch.price_p ?? before.price_p) : before.price_p
  const oldPriceP = before.price_p
  if (newPriceP !== oldPriceP) {
    const newBaseUnit = hasCostOrSize ? (patch.base_unit ?? before.base_unit) : before.base_unit
    const mode: CostPricingMode = newBaseUnit === 'each' ? 'unit' : 'bottle'
    await insertCostChange(db, {
      library_ingredient_id: id,
      pricing_mode: mode,
      old_cost_p: oldPriceP,
      new_cost_p: newPriceP,
      source: 'manual',
    })
  }
}

export async function deleteLibraryEntry(
  db: D1Database,
  id: string,
  tradeAccountId: string,
): Promise<void> {
  await db
    .prepare(`DELETE FROM pouriq_ingredients_library WHERE id = ?1 AND trade_account_id = ?2`)
    .bind(id, tradeAccountId)
    .run()
}

export async function getLibraryEntryUsage(
  db: D1Database,
  libraryIngredientId: string,
): Promise<IngredientLibraryUsage[]> {
  const result = await db
    .prepare(`
      SELECT
        i.id AS id,
        c.id AS cocktail_id,
        c.name AS cocktail_name,
        m.id AS menu_id,
        m.name AS menu_name
      FROM pouriq_ingredients i
      JOIN pouriq_cocktails c ON c.id = i.cocktail_id
      JOIN pouriq_menus m ON m.id = c.menu_id
      WHERE i.library_ingredient_id = ?1
      ORDER BY m.name, c.name
    `)
    .bind(libraryIngredientId)
    .all<IngredientLibraryUsage>()
  return result.results ?? []
}

export async function getLibraryUsageCounts(
  db: D1Database,
  tradeAccountId: string,
): Promise<Map<string, number>> {
  const result = await db
    .prepare(`
      SELECT i.library_ingredient_id AS lib_id, COUNT(*) AS n
      FROM pouriq_ingredients i
      JOIN pouriq_cocktails c ON c.id = i.cocktail_id
      JOIN pouriq_menus m ON m.id = c.menu_id
      WHERE m.trade_account_id = ?1
      GROUP BY i.library_ingredient_id
    `)
    .bind(tradeAccountId)
    .all<{ lib_id: string; n: number }>()
  const map = new Map<string, number>()
  for (const row of result.results ?? []) {
    map.set(row.lib_id, row.n)
  }
  return map
}
