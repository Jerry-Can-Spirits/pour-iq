// Server-side loader for cost-change ripple impact data.
//
// Single source of truth for the SQL + row→payload assembly. Used both by
// the impact API route and by the ingredient edit page (which fetches
// server-side to avoid a client waterfall on every keystroke).

import { getLibraryEntry } from './ingredient-library'
import { usableCostPerBaseUnitP } from './calculations'
import type {
  CostImpactPayload,
  ImpactCocktail,
  ImpactIngredient,
} from './cost-impact'

interface RawRow {
  cocktail_id: string
  cocktail_name: string
  cocktail_sale_price_p: number
  menu_id: string
  menu_name: string
  menu_target_gp_pct: number
  menu_prices_include_vat: number
  ingredient_library_id: string
  ingredient_pour_ml: number | null
  ingredient_unit_count: number | null
  lib_base_unit: 'ml' | 'g' | 'each'
  lib_pack_size: number
  lib_price_p: number
  lib_purchase_qty: number
  lib_yield_pct: number
}

export function rowContributionP(row: Pick<RawRow, 'lib_price_p' | 'lib_purchase_qty' | 'lib_pack_size' | 'lib_yield_pct' | 'lib_base_unit' | 'ingredient_pour_ml' | 'ingredient_unit_count'>): number {
  const perBaseUnit = usableCostPerBaseUnitP(row.lib_price_p, row.lib_purchase_qty, row.lib_pack_size, row.lib_yield_pct)
  const amount = row.lib_base_unit === 'each'
    ? (row.ingredient_unit_count ?? 0)
    : (row.ingredient_pour_ml ?? 0)
  if (amount === 0) return 0
  return Math.round(perBaseUnit * amount)
}

/**
 * Builds a {@link CostImpactPayload} for one ingredient, scoped to a
 * single trade account. Returns null when the ingredient isn't found.
 */
export async function loadImpactPayload(
  db: D1Database,
  ingredientId: string,
  tradeAccountId: string,
): Promise<CostImpactPayload | null> {
  const entry = await getLibraryEntry(db, ingredientId, tradeAccountId)
  if (!entry) return null

  const result = await db
    .prepare(`
      WITH affected AS (
        SELECT DISTINCT c.id AS cocktail_id
        FROM pouriq_ingredients i
        JOIN pouriq_cocktails c ON c.id = i.cocktail_id
        JOIN pouriq_menus m ON m.id = c.menu_id
        WHERE i.library_ingredient_id = ?1
          AND m.trade_account_id = ?2
      )
      SELECT
        c.id AS cocktail_id,
        c.name AS cocktail_name,
        c.sale_price_p AS cocktail_sale_price_p,
        m.id AS menu_id,
        m.name AS menu_name,
        m.target_gp_pct AS menu_target_gp_pct,
        m.prices_include_vat AS menu_prices_include_vat,
        i.library_ingredient_id AS ingredient_library_id,
        i.pour_ml AS ingredient_pour_ml,
        i.unit_count AS ingredient_unit_count,
        lib.base_unit AS lib_base_unit,
        lib.pack_size AS lib_pack_size,
        lib.price_p AS lib_price_p,
        lib.purchase_qty AS lib_purchase_qty,
        lib.yield_pct AS lib_yield_pct
      FROM affected a
      JOIN pouriq_cocktails c ON c.id = a.cocktail_id
      JOIN pouriq_menus m ON m.id = c.menu_id
      JOIN pouriq_ingredients i ON i.cocktail_id = c.id
      JOIN pouriq_ingredients_library lib ON lib.id = i.library_ingredient_id
      ORDER BY m.name, c.name
    `)
    .bind(ingredientId, tradeAccountId)
    .all<RawRow>()

  const rows = result.results ?? []
  const byCocktail = new Map<string, RawRow[]>()
  for (const row of rows) {
    if (!byCocktail.has(row.cocktail_id)) byCocktail.set(row.cocktail_id, [])
    byCocktail.get(row.cocktail_id)!.push(row)
  }

  const affected: ImpactCocktail[] = []
  for (const cocktailRows of byCocktail.values()) {
    const first = cocktailRows[0]
    let totalPourCost = 0
    let thisContribution = 0
    let pourMl: number | null = null
    let unitCount: number | null = null
    for (const r of cocktailRows) {
      const contribution = rowContributionP(r)
      totalPourCost += contribution
      if (r.ingredient_library_id === ingredientId) {
        thisContribution += contribution
        pourMl = r.ingredient_pour_ml
        unitCount = r.ingredient_unit_count
      }
    }
    affected.push({
      cocktail_id: first.cocktail_id,
      cocktail_name: first.cocktail_name,
      menu_id: first.menu_id,
      menu_name: first.menu_name,
      menu_target_gp_pct: first.menu_target_gp_pct,
      menu_prices_include_vat: first.menu_prices_include_vat === 1,
      sale_price_p: first.cocktail_sale_price_p,
      current_pour_cost_p: totalPourCost,
      current_ingredient_contribution_p: thisContribution,
      pour_ml: pourMl,
      unit_count: unitCount,
    })
  }

  const ingredient: ImpactIngredient = {
    id: entry.id,
    name: entry.name,
    ingredient_type: entry.ingredient_type,
    base_unit: entry.base_unit,
    pack_size: entry.pack_size,
    price_p: entry.price_p,
    purchase_qty: entry.purchase_qty,
    yield_pct: entry.yield_pct,
  }

  return { ingredient, affected }
}
