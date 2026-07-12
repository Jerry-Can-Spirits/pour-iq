'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from './access'
import { VARIANCE_REASONS, MENU_THEMES, type ItemType } from './types'
import {
  insertMenu, updateMenu, deleteMenu, setActiveMenu,
  insertCocktail, replaceIngredients,
  getMenu, listCocktailsForMenu, getOrCreateServesMenu,
  listIngredientServes, reorderDrinks,
} from './menus'
import {
  insertLibraryEntry,
  updateLibraryEntry,
  deleteLibraryEntry,
  getLibraryEntry,
  getLibraryUsageCounts,
  type IngredientLibraryInsert,
} from './ingredient-library'
import { listIngredientUses, replaceIngredientUses } from './ingredient-uses'
import { deleteInvoice } from './invoices'
import { matchFieldManualSlug } from './field-manual-match'
import { upsertVoiceProfile, type VoiceProfileInput } from './voice-profile'
import {
  loadPreparedGraph,
  wouldCreateCycle,
  recomputePreparedCost,
  recomputeDependents,
  listPreparedComponents,
} from './prepared'
import {
  createSection,
  renameSection,
  deleteSection,
  reorderSections,
  moveDrink,
  cloneSections,
} from './menu-sections'

async function requireDb() {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') redirect('/login')
  const { env } = await getCloudflareContext()
  return { db: env.DB as D1Database, tradeAccountId: access.tradeAccountId }
}

export async function createMenuAction(formData: FormData): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) throw new Error('Name is required')
  const target_gp_pct = Number(formData.get('target_gp_pct') ?? 75)
  const venue_type = String(formData.get('venue_type') ?? '').trim() || null
  const city = String(formData.get('city') ?? '').trim() || null
  const positioning = String(formData.get('positioning') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null
  const prices_include_vat = String(formData.get('prices_include_vat') ?? '1') !== '0'

  const id = await insertMenu(db, {
    trade_account_id: tradeAccountId,
    name, venue_type, city, target_gp_pct, positioning, notes,
    prices_include_vat,
  })
  revalidatePath('/')
  redirect(`/${id}`)
}

export async function setActiveMenuAction(menuId: string): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  await setActiveMenu(db, tradeAccountId, menuId)
  revalidatePath('/')
  revalidatePath(`/${menuId}`)
}

export async function cloneMenuAction(menuId: string, newName?: string): Promise<{ menuId: string }> {
  const { db, tradeAccountId } = await requireDb()
  const source = await getMenu(db, menuId, tradeAccountId)
  if (!source) throw new Error('Menu not found')

  // Copy menu metadata.
  const newId = await insertMenu(db, {
    trade_account_id: tradeAccountId,
    name: (newName?.trim() || `Copy of ${source.name}`).slice(0, 200),
    venue_type: source.venue_type,
    city: source.city,
    target_gp_pct: source.target_gp_pct,
    positioning: source.positioning,
    notes: source.notes,
    prices_include_vat: source.prices_include_vat === 1,
  })

  // Copy the section structure first, keeping a map from each source section
  // id to its new id so cloned drinks can be re-pointed at the right section.
  const sectionIdMap = await cloneSections(db, menuId, newId)

  // Copy every cocktail with its ingredient links. Volumes and analyses
  // are intentionally NOT copied — they are time-bound to the original
  // menu's actual operation.
  const cocktails = await listCocktailsForMenu(db, menuId)
  for (let idx = 0; idx < cocktails.length; idx++) {
    const c = cocktails[idx]
    const newCocktailId = await insertCocktail(db, {
      menu_id: newId,
      name: c.name,
      sale_price_p: c.sale_price_p,
      promotional_price_p: c.promotional_price_p,
      promotional_label: c.promotional_label,
      promotional_days: c.promotional_days,
      promotional_valid_from: c.promotional_valid_from,
      promotional_valid_until: c.promotional_valid_until,
      position: c.position ?? idx,
      field_manual_slug: c.field_manual_slug,
      notes: c.notes,
      glass: c.glass,
      item_type: c.item_type,
    })
    // Re-point the cloned drink at its copied section (insertCocktail leaves it
    // unplaced; the source drink's section maps through sectionIdMap).
    const newSectionId = c.section_id ? sectionIdMap.get(c.section_id) : undefined
    if (newSectionId) {
      await db
        .prepare(`UPDATE pouriq_cocktails SET section_id = ?1 WHERE id = ?2`)
        .bind(newSectionId, newCocktailId)
        .run()
    }
    if (c.ingredients.length > 0) {
      await replaceIngredients(db, newCocktailId, tradeAccountId, c.ingredients.map((i) => ({
        library_ingredient_id: i.library_ingredient_id,
        pour_ml: i.pour_ml,
        unit_count: i.unit_count,
        recipe_unit: i.recipe_unit,
        recipe_qty: i.recipe_qty,
        use_id: i.use_id,
      })))
    }
  }

  revalidatePath('/')
  return { menuId: newId }
}

export async function setMenuVatModeAction(menuId: string, includesVat: boolean): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  await updateMenu(db, menuId, tradeAccountId, {
    prices_include_vat: includesVat ? 1 : 0,
  })
  revalidatePath(`/${menuId}`)
}

export async function updateMenuAction(menuId: string, formData: FormData): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  await updateMenu(db, menuId, tradeAccountId, {
    name: String(formData.get('name') ?? '').trim(),
    target_gp_pct: Number(formData.get('target_gp_pct') ?? 75),
    venue_type: String(formData.get('venue_type') ?? '').trim() || null,
    city: String(formData.get('city') ?? '').trim() || null,
    positioning: String(formData.get('positioning') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
  })
  revalidatePath(`/${menuId}`)
}

export async function deleteMenuAction(menuId: string): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  await deleteMenu(db, menuId, tradeAccountId)
  revalidatePath('/')
  redirect('/menus')
}

export async function deleteInvoiceAction(invoiceId: string): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  const result = await deleteInvoice(db, invoiceId, tradeAccountId)
  if (result?.r2_key) {
    const { env } = await getCloudflareContext()
    try {
      await (env.TRADE_DOCS as R2Bucket).delete(result.r2_key)
    } catch {
      // Best-effort: the DB record is already gone; a stray R2 object is harmless.
    }
  }
  // Invoice existence drives the onboarding setup panel on the dashboard.
  revalidatePath('/invoices')
  revalidatePath('/')
  redirect('/invoices')
}

interface CocktailInput {
  name: string
  sale_price_p: number
  promotional_price_p: number | null
  promotional_label: string | null
  promotional_days: string | null
  promotional_valid_from: string | null
  promotional_valid_until: string | null
  notes: string | null
  glass: string | null
  item_type?: ItemType
  ingredients: Array<{
    library_ingredient_id: string
    pour_ml: number | null
    unit_count: number | null
    recipe_unit: string | null
    recipe_qty: number | null
    use_id: string | null
  }>
}

export async function saveCocktailAction(
  menuId: string,
  cocktailId: string | null,
  input: CocktailInput,
): Promise<{ cocktailId: string }> {
  const { db, tradeAccountId } = await requireDb()
  const menu = await getMenu(db, menuId, tradeAccountId)
  if (!menu) throw new Error('Menu not found')

  const slug = await matchFieldManualSlug(input.name)

  let id: string
  if (cocktailId === null) {
    id = await insertCocktail(db, {
      menu_id: menuId,
      name: input.name,
      sale_price_p: input.sale_price_p,
      promotional_price_p: input.promotional_price_p,
      promotional_label: input.promotional_label,
      promotional_days: input.promotional_days,
      promotional_valid_from: input.promotional_valid_from,
      promotional_valid_until: input.promotional_valid_until,
      position: 0,
      field_manual_slug: slug,
      notes: input.notes,
      glass: input.glass,
      item_type: input.item_type ?? 'cocktail',
    })
  } else {
    id = cocktailId
    await db
      .prepare(`UPDATE pouriq_cocktails SET name = ?1, sale_price_p = ?2, promotional_price_p = ?3, promotional_label = ?4, promotional_days = ?5, promotional_valid_from = ?6, promotional_valid_until = ?7, field_manual_slug = ?8, notes = ?9, glass = ?10, item_type = ?11, updated_at = datetime('now') WHERE id = ?12 AND menu_id = ?13`)
      .bind(
        input.name, input.sale_price_p,
        input.promotional_price_p, input.promotional_label,
        input.promotional_days, input.promotional_valid_from, input.promotional_valid_until,
        slug, input.notes, input.glass, input.item_type ?? 'cocktail', id, menuId,
      )
      .run()
  }
  await replaceIngredients(db, id, tradeAccountId, input.ingredients)
  revalidatePath(`/${menuId}`)
  return { cocktailId: id }
}

export type BulkPromoMode = 'percent' | 'flat' | 'clear'

interface BulkPromoInput {
  mode: BulkPromoMode
  amount?: number  // percent (1-99) or pence (positive integer) depending on mode
  label?: string | null
  // Day-of-week constraint (CSV of 0-6, 0=Sun). null = every day.
  days?: string | null
  valid_from?: string | null  // ISO YYYY-MM-DD
  valid_until?: string | null
}

export async function bulkApplyPromoAction(menuId: string, input: BulkPromoInput): Promise<{ updated: number }> {
  const { db, tradeAccountId } = await requireDb()
  const menu = await getMenu(db, menuId, tradeAccountId)
  if (!menu) throw new Error('Menu not found')

  if (input.mode === 'clear') {
    const result = await db
      .prepare(`UPDATE pouriq_cocktails SET promotional_price_p = NULL, promotional_label = NULL, promotional_days = NULL, promotional_valid_from = NULL, promotional_valid_until = NULL WHERE menu_id = ?1`)
      .bind(menuId)
      .run()
    revalidatePath(`/${menuId}`)
    return { updated: result.meta?.changes ?? 0 }
  }

  const amount = input.amount ?? 0
  if (input.mode === 'percent') {
    if (!Number.isFinite(amount) || amount < 1 || amount > 99) {
      throw new Error('Percentage off must be between 1 and 99')
    }
  } else {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Flat amount off must be a positive integer (pence)')
    }
  }
  const label = input.label?.trim() || null
  const days = input.days?.trim() || null
  const validFrom = input.valid_from?.trim() || null
  const validUntil = input.valid_until?.trim() || null

  // Apply per-drink so we can compute promo price from each drink's own sale price.
  const drinks = await db
    .prepare(`SELECT id, sale_price_p FROM pouriq_cocktails WHERE menu_id = ?1`)
    .bind(menuId)
    .all<{ id: string; sale_price_p: number }>()
  const rows = drinks.results ?? []

  const statements: D1PreparedStatement[] = []
  let updated = 0
  for (const r of rows) {
    let promo_p: number
    if (input.mode === 'percent') {
      promo_p = Math.round(r.sale_price_p * (1 - amount / 100))
    } else {
      promo_p = r.sale_price_p - amount
    }
    // Skip if the computed promo is non-positive or would equal/exceed the
    // normal price (no-op or invalid).
    if (promo_p <= 0 || promo_p >= r.sale_price_p) continue
    statements.push(
      db
        .prepare(`UPDATE pouriq_cocktails SET promotional_price_p = ?1, promotional_label = ?2, promotional_days = ?3, promotional_valid_from = ?4, promotional_valid_until = ?5 WHERE id = ?6 AND menu_id = ?7`)
        .bind(promo_p, label, days, validFrom, validUntil, r.id, menuId),
    )
    updated++
  }
  if (statements.length > 0) await db.batch(statements)
  revalidatePath(`/${menuId}`)
  return { updated }
}

export async function deleteCocktailAction(menuId: string, cocktailId: string): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  // Verify the menu belongs to this tenant before deleting any cocktails from it.
  const menu = await getMenu(db, menuId, tradeAccountId)
  if (!menu) throw new Error('Menu not found')
  // Restrict delete to cocktails that actually belong to this menu.
  await db
    .prepare(`DELETE FROM pouriq_cocktails WHERE id = ?1 AND menu_id = ?2`)
    .bind(cocktailId, menuId)
    .run()
  revalidatePath(`/${menuId}`)
}

// LibraryEntryInput is the public-facing shape for saveLibraryEntryAction.
// It mirrors IngredientLibraryInsert without the server-only trade_account_id.
export type LibraryEntryInput = Omit<IngredientLibraryInsert, 'trade_account_id'>

const VALID_BASE_UNITS = new Set(['ml', 'g', 'each'])

export async function saveLibraryEntryAction(
  entryId: string | null,
  input: LibraryEntryInput,
): Promise<{ entryId: string }> {
  const { db, tradeAccountId } = await requireDb()

  const isPrepared = !!input.is_prepared

  if (!isPrepared) {
    // Standard ingredient: all cost/size fields are required and validated.
    if (input.base_unit !== undefined && !VALID_BASE_UNITS.has(input.base_unit)) throw new Error('Invalid base_unit')
    if (input.price_p !== undefined && (!Number.isFinite(input.price_p) || input.price_p < 0)) throw new Error('price_p must be a non-negative number')
    if (input.pack_size !== undefined && (!Number.isFinite(input.pack_size) || input.pack_size <= 0)) throw new Error('pack_size must be a positive number')
    if (input.purchase_qty !== undefined && (!Number.isInteger(input.purchase_qty) || input.purchase_qty < 1)) throw new Error('purchase_qty must be a positive whole number')
  }

  let savedId: string
  if (entryId === null) {
    if (isPrepared) {
      // Prepared ingredient: yield unit = base_unit, yield amount = pack_size,
      // purchase_qty = 1, yield_pct = 100. Price is derived; default to 0 until
      // components are added.
      savedId = await insertLibraryEntry(db, {
        ...input,
        trade_account_id: tradeAccountId,
        is_prepared: 1,
        price_p: 0,
        price_includes_vat: 0,
        price_entered_p: 0,
        purchase_qty: 1,
        yield_pct: 100,
      })
    } else {
      savedId = await insertLibraryEntry(db, { ...input, trade_account_id: tradeAccountId, is_prepared: 0 })
    }
  } else {
    // Verify ownership before update
    const existing = await getLibraryEntry(db, entryId, tradeAccountId)
    if (!existing) throw new Error('Ingredient not found')
    if (isPrepared) {
      await updateLibraryEntry(db, entryId, tradeAccountId, {
        ...input,
        is_prepared: 1,
        price_includes_vat: 0,
        price_entered_p: 0,
        purchase_qty: 1,
        yield_pct: 100,
      })
    } else {
      await updateLibraryEntry(db, entryId, tradeAccountId, { ...input, is_prepared: 0 })
    }
    savedId = entryId
  }

  if (isPrepared) {
    await recomputePreparedCost(db, savedId)
    await recomputeDependents(db, tradeAccountId, savedId)
  } else if (entryId !== null) {
    // Non-prepared update: any cost-field change should propagate to prepared
    // recipes that use this ingredient. recomputeDependents is a no-op when
    // nothing depends on this ingredient.
    await recomputeDependents(db, tradeAccountId, entryId)
  }

  // Best-effort contribution to the cross-tenant barcode catalogue. Only
  // attributes are shared — no cost, no tenant data. Failures here must
  // not block the user's save.
  if (input.barcode && input.barcode.trim()) {
    try {
      const { contributeToCatalogue } = await import('./barcode-catalogue')
      await contributeToCatalogue(db, {
        barcode: input.barcode.trim(),
        name: input.name.trim(),
        ingredient_type: input.ingredient_type,
        pack_size_ml: input.base_unit === 'ml' ? input.pack_size : null,
        trade_account_id: tradeAccountId,
      })
    } catch { /* swallow — non-critical */ }
  }

  revalidatePath('/library')
  if (entryId !== null) revalidatePath(`/library/${entryId}/edit`)
  return { entryId: savedId }
}

// Attach a scanned barcode to an existing library entry — the duplicate-safe
// alternative to creating a new ingredient when a scan doesn't match.
export async function attachBarcodeAction(entryId: string, barcode: string): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  const code = barcode.trim()
  if (!code || code.length > 64) throw new Error('Invalid barcode')
  const existing = await getLibraryEntry(db, entryId, tradeAccountId)
  if (!existing) throw new Error('Ingredient not found')
  await db
    .prepare(`UPDATE pouriq_ingredients_library SET barcode = ?1, updated_at = datetime('now') WHERE id = ?2 AND trade_account_id = ?3`)
    .bind(code, entryId, tradeAccountId)
    .run()
  try {
    const { contributeToCatalogue } = await import('./barcode-catalogue')
    await contributeToCatalogue(db, {
      barcode: code,
      name: existing.name,
      ingredient_type: existing.ingredient_type,
      pack_size_ml: existing.base_unit === 'ml' ? existing.pack_size : null,
      trade_account_id: tradeAccountId,
    })
  } catch { /* swallow — non-critical */ }
  revalidatePath('/library')
  revalidatePath(`/library/${entryId}/edit`)
}

export async function addPreparedComponentAction(
  preparedId: string,
  componentId: string,
  amount_base: number,
  recipe_unit: string | null,
  recipe_qty: number | null,
): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  if (!Number.isFinite(amount_base) || amount_base <= 0) throw new Error('Component amount must be positive')
  if (preparedId === componentId) throw new Error('A recipe cannot contain itself')
  // Both ingredients must belong to the tenant.
  const ok = await db
    .prepare(`SELECT COUNT(*) AS n FROM pouriq_ingredients_library WHERE id IN (?1, ?2) AND trade_account_id = ?3`)
    .bind(preparedId, componentId, tradeAccountId)
    .first<{ n: number }>()
  if (!ok || ok.n < 2) throw new Error('Ingredient not found')
  const graph = await loadPreparedGraph(db, tradeAccountId)
  if (wouldCreateCycle(graph, preparedId, componentId)) throw new Error('That would create a loop between recipes')
  await db
    .prepare(`
      INSERT INTO pouriq_prepared_components (prepared_ingredient_id, component_ingredient_id, amount_base, recipe_unit, recipe_qty)
      VALUES (?1, ?2, ?3, ?4, ?5)
    `)
    .bind(preparedId, componentId, amount_base, recipe_unit, recipe_qty)
    .run()
  await recomputePreparedCost(db, preparedId)
  await recomputeDependents(db, tradeAccountId, preparedId)
  revalidatePath(`/library/${preparedId}/edit`)
  revalidatePath('/library')
}

export async function removePreparedComponentAction(componentRowId: string): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  // Resolve the parent prepared ingredient + tenant-guard via join.
  const row = await db
    .prepare(`
      SELECT pc.prepared_ingredient_id AS preparedId
      FROM pouriq_prepared_components pc
      JOIN pouriq_ingredients_library lib ON lib.id = pc.prepared_ingredient_id
      WHERE pc.id = ?1 AND lib.trade_account_id = ?2
    `)
    .bind(componentRowId, tradeAccountId)
    .first<{ preparedId: string }>()
  if (!row) throw new Error('Component not found')
  await db.prepare(`DELETE FROM pouriq_prepared_components WHERE id = ?1`).bind(componentRowId).run()
  await recomputePreparedCost(db, row.preparedId)
  await recomputeDependents(db, tradeAccountId, row.preparedId)
  revalidatePath(`/library/${row.preparedId}/edit`)
  revalidatePath('/library')
}

export async function saveIngredientUsesAction(
  ingredientId: string,
  uses: Array<{ name: string; recipe_unit: 'ml' | 'count' | 'g'; yield_qty: number }>,
): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  const existing = await getLibraryEntry(db, ingredientId, tradeAccountId)
  if (!existing) throw new Error('Ingredient not found')
  await replaceIngredientUses(db, ingredientId, uses)
  revalidatePath('/library')
  revalidatePath(`/library/${ingredientId}/edit`)
}

export async function listIngredientUsesAction(ingredientId: string) {
  const { db, tradeAccountId } = await requireDb()
  const existing = await getLibraryEntry(db, ingredientId, tradeAccountId)
  if (!existing) throw new Error('Ingredient not found')
  return listIngredientUses(db, ingredientId)
}

export async function deleteLibraryEntryAction(entryId: string): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  // Block delete if in use — match the UI guard
  const usage = await getLibraryUsageCounts(db, tradeAccountId)
  if ((usage.get(entryId) ?? 0) > 0) {
    throw new Error('Cannot delete: ingredient is used in one or more drinks')
  }
  // Verify ownership before delete
  const existing = await getLibraryEntry(db, entryId, tradeAccountId)
  if (!existing) throw new Error('Ingredient not found')
  await deleteLibraryEntry(db, entryId, tradeAccountId)
  revalidatePath('/library')
}

export async function bulkDeleteLibraryEntriesAction(entryIds: string[]): Promise<{ deleted: number }> {
  const { db, tradeAccountId } = await requireDb()
  if (entryIds.length === 0) return { deleted: 0 }
  const usage = await getLibraryUsageCounts(db, tradeAccountId)
  let deleted = 0
  for (const id of entryIds) {
    // Skip anything in use (same rule as single delete) — defensive even though
    // the UI only offers unused ingredients.
    if ((usage.get(id) ?? 0) > 0) continue
    await deleteLibraryEntry(db, id, tradeAccountId)
    deleted++
  }
  revalidatePath('/library')
  return { deleted }
}

export async function saveServeAction(
  serveId: string | null,
  input: { name: string; glass: string | null; sale_price_p?: number; ingredients: Array<{ library_ingredient_id: string; pour_ml: number | null; unit_count: number | null; recipe_unit: string | null; recipe_qty: number | null; use_id: string | null }> },
): Promise<{ serveId: string }> {
  const { db, tradeAccountId } = await requireDb()
  if (!input.name.trim()) throw new Error('Serve name is required')
  const menuId = await getOrCreateServesMenu(db, tradeAccountId)
  const salePriceP = input.sale_price_p ?? 0
  let id = serveId
  if (id === null) {
    const row = await db
      .prepare(`
        INSERT INTO pouriq_cocktails (menu_id, name, sale_price_p, position, field_manual_slug, notes, glass, is_serve)
        VALUES (?1, ?2, ?3, 0, NULL, NULL, ?4, 1) RETURNING id
      `)
      .bind(menuId, input.name.trim(), salePriceP, input.glass)
      .first<{ id: string }>()
    if (!row) throw new Error('Serve insert returned no id')
    id = row.id
  } else {
    const owns = await db
      .prepare(`SELECT 1 FROM pouriq_cocktails WHERE id = ?1 AND menu_id = ?2 AND is_serve = 1`)
      .bind(id, menuId)
      .first()
    if (!owns) throw new Error('Serve not found')
    await db
      .prepare(`UPDATE pouriq_cocktails SET name = ?1, glass = ?2, sale_price_p = ?3 WHERE id = ?4`)
      .bind(input.name.trim(), input.glass, salePriceP, id)
      .run()
  }
  await replaceIngredients(db, id, tradeAccountId, input.ingredients)
  revalidatePath('/serves')
  return { serveId: id }
}

export async function deleteServeAction(serveId: string): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  const menuId = await getOrCreateServesMenu(db, tradeAccountId)
  const owns = await db
    .prepare(`SELECT 1 FROM pouriq_cocktails WHERE id = ?1 AND menu_id = ?2 AND is_serve = 1`)
    .bind(serveId, menuId)
    .first()
  if (!owns) throw new Error('Serve not found')
  await db.prepare(`DELETE FROM pouriq_cocktails WHERE id = ?1`).bind(serveId).run()
  revalidatePath('/serves')
}

export async function createIngredientServeAction(
  libraryIngredientId: string,
  name: string,
  pourMl: number,
  salePriceP: number,
): Promise<{ serveId: string }> {
  const { db, tradeAccountId } = await requireDb()
  if (!name.trim()) throw new Error('Serve name is required')
  if (pourMl <= 0) throw new Error('Pour size must be greater than 0')
  const owns = await db
    .prepare(`SELECT 1 FROM pouriq_ingredients_library WHERE id = ?1 AND trade_account_id = ?2`)
    .bind(libraryIngredientId, tradeAccountId)
    .first()
  if (!owns) throw new Error('Ingredient not found')
  const menuId = await getOrCreateServesMenu(db, tradeAccountId)
  const row = await db
    .prepare(`
      INSERT INTO pouriq_cocktails (menu_id, name, sale_price_p, position, field_manual_slug, notes, glass, is_serve)
      VALUES (?1, ?2, ?3, 0, NULL, NULL, NULL, 1) RETURNING id
    `)
    .bind(menuId, name.trim(), salePriceP)
    .first<{ id: string }>()
  if (!row) throw new Error('Serve insert returned no id')
  await replaceIngredients(db, row.id, tradeAccountId, [{
    library_ingredient_id: libraryIngredientId,
    pour_ml: pourMl,
    unit_count: null,
    recipe_unit: null,
    recipe_qty: null,
    use_id: null,
  }])
  revalidatePath(`/library/${libraryIngredientId}/edit`)
  revalidatePath('/serves')
  return { serveId: row.id }
}

export async function listIngredientServesAction(libraryIngredientId: string) {
  const { db, tradeAccountId } = await requireDb()
  return listIngredientServes(db, tradeAccountId, libraryIngredientId)
}

// Promote an ingredient's serves onto a real menu as proper drinks. MOVES the
// rows (re-parents off the hidden serves menu) rather than copying, so the
// same pour can never exist twice and split POS sales between two homes.
export async function addIngredientServesToMenuAction(
  libraryIngredientId: string,
  targetMenuId: string,
): Promise<{ moved: number }> {
  const { db, tradeAccountId } = await requireDb()
  const menu = await db
    .prepare(`SELECT 1 FROM pouriq_menus WHERE id = ?1 AND trade_account_id = ?2 AND is_serves_menu = 0`)
    .bind(targetMenuId, tradeAccountId)
    .first()
  if (!menu) throw new Error('Menu not found')
  const serves = await listIngredientServes(db, tradeAccountId, libraryIngredientId)
  if (serves.length === 0) return { moved: 0 }
  const posRow = await db
    .prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM pouriq_cocktails WHERE menu_id = ?1`)
    .bind(targetMenuId)
    .first<{ next: number }>()
  const base = posRow?.next ?? 0
  await db.batch(
    serves.map((s, i) =>
      db
        .prepare(`UPDATE pouriq_cocktails SET menu_id = ?1, is_serve = 0, section_id = NULL, position = ?2, updated_at = datetime('now') WHERE id = ?3`)
        .bind(targetMenuId, base + i, s.id),
    ),
  )
  revalidatePath(`/${targetMenuId}`)
  revalidatePath('/serves')
  revalidatePath(`/library/${libraryIngredientId}/edit`)
  return { moved: serves.length }
}

export async function receiveStockAction(libraryIngredientId: string, qtyBottles: number, receivedAtISO?: string): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  if (!Number.isFinite(qtyBottles) || qtyBottles <= 0) throw new Error('Enter a positive quantity')
  const owns = await db.prepare(`SELECT 1 FROM pouriq_ingredients_library WHERE id = ?1 AND trade_account_id = ?2`).bind(libraryIngredientId, tradeAccountId).first()
  if (!owns) throw new Error('Ingredient not found')
  await db.prepare(`
    INSERT INTO pouriq_stock_receipts (trade_account_id, library_ingredient_id, received_at, qty, source, invoice_line_id)
    VALUES (?1, ?2, ?3, ?4, 'manual', NULL)
  `).bind(tradeAccountId, libraryIngredientId, receivedAtISO ?? new Date().toISOString(), qtyBottles).run()
  revalidatePath('/stock')
}

export async function recordStockCountAction(libraryIngredientId: string, countQty: number): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  if (!Number.isFinite(countQty) || countQty < 0) throw new Error('Enter a non-negative count')
  const owns = await db.prepare(`SELECT 1 FROM pouriq_ingredients_library WHERE id = ?1 AND trade_account_id = ?2`).bind(libraryIngredientId, tradeAccountId).first()
  if (!owns) throw new Error('Ingredient not found')
  await db.prepare(`
    INSERT INTO pouriq_stock_count_events (trade_account_id, library_ingredient_id, counted_at, count_qty, reason)
    VALUES (?1, ?2, datetime('now'), ?3, NULL)
  `).bind(tradeAccountId, libraryIngredientId, countQty).run()
  revalidatePath('/stock')
}

export async function setParAction(libraryIngredientId: string, parBottles: number | null): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  if (parBottles !== null && (!Number.isFinite(parBottles) || parBottles < 0)) throw new Error('Par must be a non-negative number')
  const owns = await db.prepare(`SELECT 1 FROM pouriq_ingredients_library WHERE id = ?1 AND trade_account_id = ?2`).bind(libraryIngredientId, tradeAccountId).first()
  if (!owns) throw new Error('Ingredient not found')
  await db.prepare(`
    UPDATE pouriq_ingredients_library SET par_bottles = ?1, updated_at = datetime('now') WHERE id = ?2 AND trade_account_id = ?3
  `).bind(parBottles, libraryIngredientId, tradeAccountId).run()
  revalidatePath('/stock')
  revalidatePath('/stock/order')
}

export async function setVarianceReasonAction(libraryIngredientId: string, reason: string | null): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  if (reason !== null && !(VARIANCE_REASONS as readonly string[]).includes(reason)) throw new Error('Invalid reason')
  // Reason attaches to the latest count event for this ingredient (the period
  // whose variance the detail page shows) — no new count is created.
  const res = await db
    .prepare(`
      UPDATE pouriq_stock_count_events SET reason = ?1
      WHERE id = (
        SELECT id FROM pouriq_stock_count_events
        WHERE trade_account_id = ?2 AND library_ingredient_id = ?3
        ORDER BY counted_at DESC LIMIT 1
      )
    `)
    .bind(reason, tradeAccountId, libraryIngredientId)
    .run()
  if (!res.meta.changes) throw new Error('No stock count yet to attach a reason to')
  revalidatePath('/variance')
  revalidatePath(`/variance/${libraryIngredientId}`)
}

export async function saveServeUnitAction(libraryIngredientId: string, name: string, basePerUnit: number): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Serve unit needs a name')
  if (!Number.isFinite(basePerUnit) || basePerUnit <= 0) throw new Error('Conversion must be a positive number')
  const owns = await db
    .prepare(`SELECT 1 FROM pouriq_ingredients_library WHERE id = ?1 AND trade_account_id = ?2`)
    .bind(libraryIngredientId, tradeAccountId)
    .first()
  if (!owns) throw new Error('Ingredient not found')
  await db
    .prepare(`
      INSERT INTO pouriq_ingredient_serve_units (library_ingredient_id, name, base_per_unit)
      VALUES (?1, ?2, ?3)
      ON CONFLICT(library_ingredient_id, name) DO UPDATE SET base_per_unit = excluded.base_per_unit
    `)
    .bind(libraryIngredientId, trimmed, basePerUnit)
    .run()
  revalidatePath(`/library/${libraryIngredientId}/edit`)
  revalidatePath('/library')
}

export async function deleteServeUnitAction(serveUnitId: string): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  // Ownership verified via join to the library ingredient.
  const owns = await db
    .prepare(`
      SELECT 1 FROM pouriq_ingredient_serve_units su
      JOIN pouriq_ingredients_library lib ON lib.id = su.library_ingredient_id
      WHERE su.id = ?1 AND lib.trade_account_id = ?2
    `)
    .bind(serveUnitId, tradeAccountId)
    .first()
  if (!owns) throw new Error('Serve unit not found')
  await db
    .prepare(`DELETE FROM pouriq_ingredient_serve_units WHERE id = ?1`)
    .bind(serveUnitId)
    .run()
  revalidatePath('/library')
}

export async function recordProductionAction(preparedId: string, batches: number): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  if (!Number.isFinite(batches) || batches <= 0) throw new Error('Enter a positive number of batches')
  const prep = await db.prepare(`SELECT pack_size FROM pouriq_ingredients_library WHERE id = ?1 AND trade_account_id = ?2 AND is_prepared = 1`).bind(preparedId, tradeAccountId).first<{ pack_size: number }>()
  if (!prep) throw new Error('Prepared recipe not found')
  const components = await listPreparedComponents(db, preparedId)
  const yield_base = prep.pack_size * batches
  const evRow = await db.prepare(`
    INSERT INTO pouriq_production_events (trade_account_id, prepared_ingredient_id, batches, yield_base_produced)
    VALUES (?1, ?2, ?3, ?4) RETURNING id, produced_at
  `).bind(tradeAccountId, preparedId, batches, yield_base).first<{ id: string; produced_at: string }>()
  if (!evRow) throw new Error('Could not record production')
  for (const c of components) {
    await db.prepare(`
      INSERT INTO pouriq_production_components (production_event_id, component_ingredient_id, amount_base_consumed, produced_at)
      VALUES (?1, ?2, ?3, ?4)
    `).bind(evRow.id, c.component_ingredient_id, c.amount_base * batches, evRow.produced_at).run()
  }
  revalidatePath('/stock')
}

// --- Menu section actions ---
// Each verifies tenant ownership before mutating; revalidates the builder and menu pages.

export async function createSectionAction(
  menuId: string,
  name: string,
  parentSectionId: string | null,
): Promise<{ sectionId: string }> {
  const { db, tradeAccountId } = await requireDb()
  const menu = await getMenu(db, menuId, tradeAccountId)
  if (!menu) throw new Error('Menu not found')
  if (parentSectionId !== null) {
    const parent = await db
      .prepare(`SELECT parent_section_id FROM pouriq_menu_sections WHERE id = ?1 AND menu_id = ?2`)
      .bind(parentSectionId, menuId)
      .first<{ parent_section_id: string | null }>()
    if (!parent) throw new Error('Parent section not found')
    if (parent.parent_section_id !== null) throw new Error('Cannot nest beyond two levels')
  }
  const sectionId = await createSection(db, menuId, name, parentSectionId)
  revalidatePath(`/${menuId}`)
  revalidatePath(`/${menuId}/menu-builder`)
  return { sectionId }
}

export async function renameSectionAction(
  sectionId: string,
  menuId: string,
  name: string,
): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  const owns = await db
    .prepare(`
      SELECT 1 AS one FROM pouriq_menu_sections s
      JOIN pouriq_menus m ON m.id = s.menu_id
      WHERE s.id = ?1 AND m.id = ?2 AND m.trade_account_id = ?3
    `)
    .bind(sectionId, menuId, tradeAccountId)
    .first<{ one: number }>()
  if (!owns) throw new Error('Section not found')
  await renameSection(db, sectionId, name)
  revalidatePath(`/${menuId}`)
  revalidatePath(`/${menuId}/menu-builder`)
}

export async function deleteSectionAction(sectionId: string, menuId: string): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  const owns = await db
    .prepare(`
      SELECT 1 AS one FROM pouriq_menu_sections s
      JOIN pouriq_menus m ON m.id = s.menu_id
      WHERE s.id = ?1 AND m.id = ?2 AND m.trade_account_id = ?3
    `)
    .bind(sectionId, menuId, tradeAccountId)
    .first<{ one: number }>()
  if (!owns) throw new Error('Section not found')
  await deleteSection(db, sectionId, menuId)
  revalidatePath(`/${menuId}`)
  revalidatePath(`/${menuId}/menu-builder`)
}

export async function reorderSectionsAction(orderedIds: string[], menuId: string): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  const menu = await getMenu(db, menuId, tradeAccountId)
  if (!menu) throw new Error('Menu not found')
  if (orderedIds.length > 0) {
    const placeholders = orderedIds.map((_, i) => `?${i + 2}`).join(', ')
    const count = await db
      .prepare(`SELECT COUNT(*) AS c FROM pouriq_menu_sections WHERE id IN (${placeholders}) AND menu_id = ?1`)
      .bind(menuId, ...orderedIds)
      .first<{ c: number }>()
    if ((count?.c ?? 0) !== orderedIds.length) throw new Error('Section not found')
  }
  await reorderSections(db, orderedIds)
  revalidatePath(`/${menuId}`)
  revalidatePath(`/${menuId}/menu-builder`)
}

export async function moveDrinkAction(
  cocktailId: string,
  sectionId: string | null,
  menuId: string,
  position: number,
): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  const menu = await getMenu(db, menuId, tradeAccountId)
  if (!menu) throw new Error('Menu not found')
  const drinkOwned = await db
    .prepare(`SELECT 1 AS one FROM pouriq_cocktails WHERE id = ?1 AND menu_id = ?2`)
    .bind(cocktailId, menuId)
    .first<{ one: number }>()
  if (!drinkOwned) throw new Error('Drink not found')
  if (sectionId !== null) {
    const sectionOwned = await db
      .prepare(`SELECT 1 AS one FROM pouriq_menu_sections WHERE id = ?1 AND menu_id = ?2`)
      .bind(sectionId, menuId)
      .first<{ one: number }>()
    if (!sectionOwned) throw new Error('Section not found')
  }
  await moveDrink(db, cocktailId, sectionId, position)
  revalidatePath(`/${menuId}`)
  revalidatePath(`/${menuId}/menu-builder`)
}

export async function reorderDrinksAction(
  menuId: string,
  sectionId: string | null,
  orderedCocktailIds: string[],
): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  const menu = await getMenu(db, menuId, tradeAccountId)
  if (!menu) throw new Error('Menu not found')
  if (orderedCocktailIds.length > 0) {
    const placeholders = orderedCocktailIds.map((_, i) => `?${i + 2}`).join(', ')
    const count = await db
      .prepare(`SELECT COUNT(*) AS c FROM pouriq_cocktails WHERE id IN (${placeholders}) AND menu_id = ?1`)
      .bind(menuId, ...orderedCocktailIds)
      .first<{ c: number }>()
    if ((count?.c ?? 0) !== orderedCocktailIds.length) throw new Error('Drink not found')
  }
  if (sectionId !== null) {
    const sectionOwned = await db
      .prepare(`SELECT 1 AS one FROM pouriq_menu_sections WHERE id = ?1 AND menu_id = ?2`)
      .bind(sectionId, menuId)
      .first<{ one: number }>()
    if (!sectionOwned) throw new Error('Section not found')
  }
  await reorderDrinks(db, menuId, sectionId, orderedCocktailIds)
  revalidatePath(`/${menuId}/menu-builder`)
}

// --- Voice profile ---

export async function setVoiceProfileAction(input: VoiceProfileInput): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  // Light validation. The form already constrains the enum dropdowns, but we
  // re-check here since server actions can be called with arbitrary input.
  if (!['refined', 'casual', 'cheeky', 'classic', 'minimal', 'other'].includes(input.tone)) {
    throw new Error('Invalid tone')
  }
  if (input.tone === 'other' && !(input.tone_other && input.tone_other.trim())) {
    throw new Error('Tell us how to describe your tone (free-text required when "Other" is chosen)')
  }
  if (!['we', 'i', 'you', 'third'].includes(input.person)) {
    throw new Error('Invalid person')
  }
  if (!['short', 'medium', 'long'].includes(input.length)) {
    throw new Error('Invalid length')
  }
  if (!Array.isArray(input.rules) || !Array.isArray(input.samples)) {
    throw new Error('Rules and samples must be arrays')
  }
  // At least one sample is required.
  const cleanedSamples = input.samples.map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 3)
  if (cleanedSamples.length === 0) {
    throw new Error('Please paste at least one sample description')
  }
  const cleanedRules = input.rules.map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 30)
  await upsertVoiceProfile(db, tradeAccountId, {
    tone: input.tone,
    tone_other: input.tone === 'other' ? (input.tone_other?.trim() ?? null) : null,
    person: input.person,
    length: input.length,
    rules: cleanedRules,
    samples: cleanedSamples,
    notes: input.notes.trim(),
  })
  revalidatePath('/settings/voice-profile')
}

// --- Menu builder: theme + logo ---

export async function setMenuThemeAction(menuId: string, theme: string): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  const menu = await getMenu(db, menuId, tradeAccountId)
  if (!menu) throw new Error('Menu not found')
  if (!(MENU_THEMES as readonly string[]).includes(theme)) throw new Error('Invalid theme')
  await db
    .prepare(`UPDATE pouriq_menus SET theme = ?1, updated_at = datetime('now') WHERE id = ?2 AND trade_account_id = ?3`)
    .bind(theme, menuId, tradeAccountId)
    .run()
  revalidatePath(`/${menuId}/menu-builder`)
}

export async function setMenuLogoAlignAction(menuId: string, align: string): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  const menu = await getMenu(db, menuId, tradeAccountId)
  if (!menu) throw new Error('Menu not found')
  if (!['left', 'center', 'right'].includes(align)) throw new Error('Invalid alignment')
  await db
    .prepare(`UPDATE pouriq_menus SET logo_align = ?1, updated_at = datetime('now') WHERE id = ?2 AND trade_account_id = ?3`)
    .bind(align, menuId, tradeAccountId)
    .run()
  revalidatePath(`/${menuId}/menu-builder`)
}

export async function removeMenuLogoAction(menuId: string): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  const menu = await getMenu(db, menuId, tradeAccountId)
  if (!menu) throw new Error('Menu not found')
  if (menu.logo_r2_key) {
    const { env } = await getCloudflareContext()
    try {
      await (env.TRADE_DOCS as R2Bucket).delete(menu.logo_r2_key)
    } catch {
      // Best-effort: a stray R2 object is harmless
    }
  }
  await db
    .prepare(`UPDATE pouriq_menus SET logo_r2_key = NULL, updated_at = datetime('now') WHERE id = ?1 AND trade_account_id = ?2`)
    .bind(menuId, tradeAccountId)
    .run()
  revalidatePath(`/${menuId}/menu-builder`)
}

// --- Cocktail photo ---

export async function removeCocktailPhotoAction(menuId: string, cocktailId: string): Promise<void> {
  const { db, tradeAccountId } = await requireDb()
  const menu = await getMenu(db, menuId, tradeAccountId)
  if (!menu) throw new Error('Menu not found')
  const row = await db
    .prepare(`SELECT photo_r2_key FROM pouriq_cocktails WHERE id = ?1 AND menu_id = ?2`)
    .bind(cocktailId, menuId)
    .first<{ photo_r2_key: string | null }>()
  if (!row) throw new Error('Drink not found')
  if (row.photo_r2_key) {
    const { env } = await getCloudflareContext()
    try {
      await (env.TRADE_DOCS as R2Bucket).delete(row.photo_r2_key)
    } catch {
      // Best-effort
    }
  }
  await db
    .prepare(`UPDATE pouriq_cocktails SET photo_r2_key = NULL, updated_at = datetime('now') WHERE id = ?1 AND menu_id = ?2`)
    .bind(cocktailId, menuId)
    .run()
  revalidatePath(`/${menuId}`)
  revalidatePath(`/${menuId}/menu-builder`)
}
