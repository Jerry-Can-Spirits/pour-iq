// Combined cost-change ripple across many ingredients in one pass.
// Used by the post-invoice-commit impact page.
//
// IMPORTANT: this loader runs AFTER the commit has already updated the
// library to the new costs. To reconstruct the pre-commit state for the
// "current" side of the ripple, the caller passes both old and new cost
// per change. Loader substitutes the old cost back in when computing
// the current contribution.

import { rollupByMenu, type MenuRollup, type ProjectedCocktail } from './cost-impact'
import { netSalePrice, usableCostPerBaseUnitP } from './calculations'

export interface AppliedCostChange {
  library_ingredient_id: string
  pricing_mode: 'bottle' | 'unit'
  old_cost_p: number | null     // null when the library entry was just created by this invoice
  new_cost_p: number
}

export interface MultiCostImpactPayload {
  projected: ProjectedCocktail[]
  rollups: MenuRollup[]
  affected_drink_count: number
  newly_below_target_count: number
}

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

function placeholders(n: number, offset: number): string {
  const parts: string[] = []
  for (let i = 0; i < n; i++) parts.push(`?${offset + i}`)
  return parts.join(', ')
}

/**
 * Pour cost contribution of a single ingredient row using the supplied
 * costP (which may be the current OR the historical pre-commit value).
 */
export function contributionP(
  row: Pick<RawRow, 'ingredient_pour_ml' | 'ingredient_unit_count' | 'lib_base_unit' | 'lib_pack_size' | 'lib_purchase_qty' | 'lib_yield_pct'>,
  costP: number,
): number {
  const perBaseUnit = usableCostPerBaseUnitP(costP, row.lib_purchase_qty, row.lib_pack_size, row.lib_yield_pct)
  const amount = row.lib_base_unit === 'each'
    ? (row.ingredient_unit_count ?? 0)
    : (row.ingredient_pour_ml ?? 0)
  if (amount === 0) return 0
  return Math.round(perBaseUnit * amount)
}

export async function loadMultiCostImpact(
  db: D1Database,
  tradeAccountId: string,
  changes: AppliedCostChange[],
): Promise<MultiCostImpactPayload> {
  if (changes.length === 0) {
    return { projected: [], rollups: [], affected_drink_count: 0, newly_below_target_count: 0 }
  }

  // De-dupe by library_ingredient_id: if the same ingredient was updated
  // twice in one invoice (rare; "same product appears twice on the invoice"
  // edge case), take the latest cost change. Caller is responsible for
  // ordering changes oldest-first; this loop preserves last-wins.
  const changeByIngredient = new Map<string, AppliedCostChange>()
  for (const c of changes) changeByIngredient.set(c.library_ingredient_id, c)
  const dedupedChanges = Array.from(changeByIngredient.values())
  const changedIds = dedupedChanges.map((c) => c.library_ingredient_id)

  // Pull every ingredient row of every cocktail that uses at least one of
  // the changed library entries. Library cost fields here are POST-commit;
  // we substitute old values back in when computing current state.
  const sql = `
    WITH affected AS (
      SELECT DISTINCT c.id AS cocktail_id
      FROM pouriq_ingredients i
      JOIN pouriq_cocktails c ON c.id = i.cocktail_id
      JOIN pouriq_menus m ON m.id = c.menu_id
      WHERE i.library_ingredient_id IN (${placeholders(changedIds.length, 1)})
        AND m.trade_account_id = ?${changedIds.length + 1}
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
  `
  const result = await db
    .prepare(sql)
    .bind(...changedIds, tradeAccountId)
    .all<RawRow>()

  const rows = result.results ?? []
  const byCocktail = new Map<string, RawRow[]>()
  for (const row of rows) {
    if (!byCocktail.has(row.cocktail_id)) byCocktail.set(row.cocktail_id, [])
    byCocktail.get(row.cocktail_id)!.push(row)
  }

  const projected: ProjectedCocktail[] = []
  for (const cocktailRows of byCocktail.values()) {
    const first = cocktailRows[0]
    let currentTotal = 0
    let projectedTotal = 0

    for (const r of cocktailRows) {
      const change = changeByIngredient.get(r.ingredient_library_id)

      // Current contribution = use the pre-commit cost where this row was
      // changed by the invoice; otherwise the library's current value
      // (unchanged for non-targeted ingredients).
      // The library is currently at the NEW cost. Substitute OLD for the
      // price field, but only if old_cost_p is non-null (first-cost
      // case has no historical value — treat as 0 contribution).
      const curCostP = change
        ? (change.old_cost_p ?? 0)
        : r.lib_price_p
      currentTotal += contributionP(r, curCostP)

      // Projected contribution = use the new cost where this row was
      // changed (library is already at this value); otherwise unchanged.
      const newCostP = change ? change.new_cost_p : r.lib_price_p
      projectedTotal += contributionP(r, newCostP)
    }

    const includeVat = first.menu_prices_include_vat === 1
    const netSale = netSalePrice(first.cocktail_sale_price_p, includeVat)
    const currentMargin = netSale - currentTotal
    const projectedMargin = netSale - projectedTotal
    const currentGpPct = netSale === 0 ? 0 : (currentMargin / netSale) * 100
    const projectedGpPct = netSale === 0 ? 0 : (projectedMargin / netSale) * 100

    projected.push({
      cocktail_id: first.cocktail_id,
      cocktail_name: first.cocktail_name,
      menu_id: first.menu_id,
      menu_name: first.menu_name,
      menu_target_gp_pct: first.menu_target_gp_pct,
      menu_prices_include_vat: includeVat,
      sale_price_p: first.cocktail_sale_price_p,
      current_pour_cost_p: currentTotal,
      // current_ingredient_contribution_p is per-ingredient in the
      // single-cost case; here we set it to 0 because the projected page
      // does not need it (RipplePreview renders current/projected totals
      // only). Keeps the type compatible.
      current_ingredient_contribution_p: 0,
      pour_ml: null,
      unit_count: null,
      projected_pour_cost_p: projectedTotal,
      projected_margin_p: projectedMargin,
      projected_gp_pct: Math.round(projectedGpPct * 10) / 10,
      current_gp_pct: Math.round(currentGpPct * 10) / 10,
      current_margin_p: currentMargin,
      below_target_now: currentGpPct < first.menu_target_gp_pct,
      below_target_after: projectedGpPct < first.menu_target_gp_pct,
    })
  }

  const rollups = rollupByMenu(projected)
  const newlyBelow = projected.filter((p) => !p.below_target_now && p.below_target_after)
  return {
    projected,
    rollups,
    affected_drink_count: projected.length,
    newly_below_target_count: newlyBelow.length,
  }
}
