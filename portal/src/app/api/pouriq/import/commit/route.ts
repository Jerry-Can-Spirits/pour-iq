// POST /api/pouriq/import/commit
// JSON body: { menuId, drinks: [...] }
// Writes drinks + library entries + ingredient rows atomically.

import { NextResponse } from 'next/server'
import * as Sentry from '@/lib/sentry'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isAllowedOrigin, isRateLimited } from '@/lib/kv'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { getMenu } from '@/lib/pouriq/menus'
import { matchFieldManualSlug } from '@/lib/pouriq/field-manual-match'
import { type IngredientType } from '@/lib/pouriq/types'
import { itemTypeFromIngredients } from '@/lib/pouriq/item-type'
import { netPriceP } from '@/lib/pouriq/calculations'
import { validateBody, type CommitBody } from '@/lib/pouriq/import-commit-validate'

export const runtime = 'nodejs'

const COMMIT_RATE_LIMIT = 30 // per hour per tenant

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace
  const db = env.DB as D1Database

  if (await isRateLimited(kv, 'pouriq-import-commit', access.tradeAccountId, COMMIT_RATE_LIMIT, 3600)) {
    return NextResponse.json({ error: 'Too many imports. Please try again later.' }, { status: 429 })
  }

  let body: CommitBody
  try {
    body = (await request.json()) as CommitBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const validationError = validateBody(body)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const menu = await getMenu(db, body.menuId, access.tradeAccountId)
  if (!menu) {
    return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
  }

  // Resolve all caller-supplied existing_library_ids up front, scoped to this tenant.
  // Doing this before phase-1 inserts ensures we never orphan newly created library rows
  // if an IDOR rejection fires partway through.
  const existingIdSet = new Set<string>()
  for (const drink of body.drinks) {
    for (const ing of drink.ingredients) {
      if (ing.existing_library_id) existingIdSet.add(ing.existing_library_id)
    }
  }
  const existingLibraryTypes = new Map<string, IngredientType>()
  if (existingIdSet.size > 0) {
    const existingIds = [...existingIdSet]
    const placeholders = existingIds.map((_, i) => `?${i + 1}`).join(', ')
    const typeRows = await db
      .prepare(
        `SELECT id, ingredient_type FROM pouriq_ingredients_library WHERE id IN (${placeholders}) AND trade_account_id = ?${existingIds.length + 1}`,
      )
      .bind(...existingIds, access.tradeAccountId)
      .all<{ id: string; ingredient_type: IngredientType }>()
    for (const row of typeRows.results ?? []) {
      existingLibraryTypes.set(row.id, row.ingredient_type)
    }
    // Reject if any caller-supplied id was not found for this tenant (unknown or foreign).
    for (const id of existingIds) {
      if (!existingLibraryTypes.has(id)) {
        return NextResponse.json(
          { error: 'One or more ingredient library entries do not belong to this account' },
          { status: 400 },
        )
      }
    }
  }

  // Dedupe new library entries by normalised name within this request. If two
  // drinks both reference the same new ingredient, we want a single library row.
  const dedupeKey = (name: string) => name.trim().toLowerCase()
  const newLibraryIdByMarker = new Map<string, string>()
  const newLibraryIdByName = new Map<string, string>()

  try {
    for (let drinkIdx = 0; drinkIdx < body.drinks.length; drinkIdx++) {
      const drink = body.drinks[drinkIdx]
      for (let ingIdx = 0; ingIdx < drink.ingredients.length; ingIdx++) {
        const ing = drink.ingredients[ingIdx]
        if (!ing.new_library) continue
        const key = dedupeKey(ing.new_library.name)
        const existing = newLibraryIdByName.get(key)
        if (existing) {
          newLibraryIdByMarker.set(`${drinkIdx}:${ingIdx}`, existing)
          continue
        }
        const includesVat = ing.new_library.price_includes_vat === true
        const netP = netPriceP(ing.new_library.price_p, includesVat)
        const result = await db
          .prepare(`
            INSERT INTO pouriq_ingredients_library
              (trade_account_id, name, ingredient_type, base_unit, pack_size, price_p,
               price_includes_vat, price_entered_p, purchase_qty, cost_confidence, pack_format)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            RETURNING id
          `)
          .bind(
            access.tradeAccountId,
            ing.new_library.name.trim(),
            ing.new_library.ingredient_type,
            ing.new_library.base_unit,
            ing.new_library.pack_size,
            netP,
            includesVat ? 1 : 0,
            ing.new_library.price_p,
            ing.new_library.purchase_qty,
            netP > 0 ? 'set' : 'estimated',
            ing.new_library.pack_format ?? null,
          )
          .first<{ id: string }>()
        if (!result) throw new Error('Library insert returned no id')
        newLibraryIdByMarker.set(`${drinkIdx}:${ingIdx}`, result.id)
        newLibraryIdByName.set(key, result.id)
      }
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'pouriq-import-commit', phase: 'library' } })
    // Remove any library rows created earlier in this request so retries don't
    // collide with the unique index (trade_account_id, LOWER(name), pack_size).
    try {
      for (const id of newLibraryIdByName.values()) {
        await db
          .prepare(`DELETE FROM pouriq_ingredients_library WHERE id = ?1 AND trade_account_id = ?2`)
          .bind(id, access.tradeAccountId)
          .run()
      }
    } catch { /* swallow */ }
    return NextResponse.json({ error: 'Could not save new library entries' }, { status: 500 })
  }

  const createdDrinkIds: string[] = []
  try {
    for (let drinkIdx = 0; drinkIdx < body.drinks.length; drinkIdx++) {
      const drink = body.drinks[drinkIdx]
      const slug = await matchFieldManualSlug(drink.name)
      const ingredientTypes = drink.ingredients.map((ing) =>
        ing.new_library
          ? ing.new_library.ingredient_type
          : (existingLibraryTypes.get(ing.existing_library_id as string) ?? 'other'),
      )
      const item_type = itemTypeFromIngredients(ingredientTypes)
      const cocktailResult = await db
        .prepare(`
          INSERT INTO pouriq_cocktails
            (menu_id, name, sale_price_p, position, field_manual_slug, item_type)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6)
          RETURNING id
        `)
        .bind(body.menuId, drink.name.trim(), drink.sale_price_p, drinkIdx, slug, item_type)
        .first<{ id: string }>()
      if (!cocktailResult) throw new Error('Cocktail insert returned no id')
      const cocktailId = cocktailResult.id
      createdDrinkIds.push(cocktailId)

      const statements: D1PreparedStatement[] = []
      for (let ingIdx = 0; ingIdx < drink.ingredients.length; ingIdx++) {
        const ing = drink.ingredients[ingIdx]
        const libraryId = ing.existing_library_id
          ?? newLibraryIdByMarker.get(`${drinkIdx}:${ingIdx}`)
        if (!libraryId) {
          throw new Error(`Ingredient ${drinkIdx}:${ingIdx} has no library reference`)
        }
        statements.push(
          db
            .prepare(`
              INSERT INTO pouriq_ingredients
                (cocktail_id, library_ingredient_id, pour_ml, unit_count, recipe_unit, recipe_qty)
              VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            `)
            .bind(cocktailId, libraryId, ing.pour_ml, ing.unit_count, ing.recipe_unit ?? null, ing.recipe_qty ?? null),
        )
      }
      await db.batch(statements)
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'pouriq-import-commit', phase: 'drinks' } })
    try {
      for (const id of createdDrinkIds) {
        await db.prepare(`DELETE FROM pouriq_cocktails WHERE id = ?1`).bind(id).run()
      }
    } catch { /* swallow */ }
    // Also remove phase-1 library rows so retries don't collide on the unique index.
    try {
      for (const id of newLibraryIdByName.values()) {
        await db
          .prepare(`DELETE FROM pouriq_ingredients_library WHERE id = ?1 AND trade_account_id = ?2`)
          .bind(id, access.tradeAccountId)
          .run()
      }
    } catch { /* swallow */ }
    return NextResponse.json({ error: 'Could not save drinks. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, drinkCount: createdDrinkIds.length })
}
