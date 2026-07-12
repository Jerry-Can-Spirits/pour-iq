// Server-side loader for variance data. Joins volumes + recipes +
// library + stock counts to build a VarianceRow[] for one menu and
// period, plus a small recent-periods summary.

import 'server-only'
import {
  calcActualUsedMl,
  calcTheoreticalUsedMl,
  calcVariance,
  calcVarianceCostP,
  type VarianceRow,
} from './variance'

export interface RecentVariancePeriod {
  period_start: string
  period_end: string
  total_abs_cost_p: number
}

export interface VariancePayload {
  current_period: { start: string; end: string }
  rows: VarianceRow[]
  recent_periods: RecentVariancePeriod[]
}

interface VolumeRow {
  cocktail_id: string
  units_sold: number
}

interface RecipeRow {
  cocktail_id: string
  library_ingredient_id: string
  pour_ml: number | null
  library_name: string
  pack_size: number
  price_p: number
  purchase_qty: number
}

interface CountRow {
  library_ingredient_id: string
  start_count: number
  end_count: number
}

interface PeriodKey {
  period_start: string
  period_end: string
}

async function readVolumes(
  db: D1Database,
  menuId: string,
  periodStart: string,
  periodEnd: string,
): Promise<VolumeRow[]> {
  const result = await db
    .prepare(`
      SELECT v.cocktail_id AS cocktail_id, v.units_sold AS units_sold
      FROM pouriq_drink_volumes v
      JOIN pouriq_cocktails c ON c.id = v.cocktail_id
      WHERE c.menu_id = ?1
        AND v.period_start = ?2
        AND v.period_end = ?3
    `)
    .bind(menuId, periodStart, periodEnd)
    .all<VolumeRow>()
  return result.results ?? []
}

async function readRecipes(
  db: D1Database,
  menuId: string,
): Promise<RecipeRow[]> {
  const result = await db
    .prepare(`
      SELECT
        c.id AS cocktail_id,
        i.library_ingredient_id AS library_ingredient_id,
        i.pour_ml AS pour_ml,
        lib.name AS library_name,
        lib.pack_size AS pack_size,
        lib.price_p AS price_p,
        lib.purchase_qty AS purchase_qty
      FROM pouriq_cocktails c
      JOIN pouriq_ingredients i ON i.cocktail_id = c.id
      JOIN pouriq_ingredients_library lib ON lib.id = i.library_ingredient_id
      WHERE c.menu_id = ?1
        AND lib.base_unit = 'ml'
        AND lib.price_p > 0
        AND i.pour_ml IS NOT NULL
    `)
    .bind(menuId)
    .all<RecipeRow>()
  return result.results ?? []
}

async function readCounts(
  db: D1Database,
  menuId: string,
  periodStart: string,
  periodEnd: string,
): Promise<CountRow[]> {
  const result = await db
    .prepare(`
      SELECT library_ingredient_id, start_count, end_count
      FROM pouriq_stock_counts
      WHERE menu_id = ?1
        AND period_start = ?2
        AND period_end = ?3
    `)
    .bind(menuId, periodStart, periodEnd)
    .all<CountRow>()
  return result.results ?? []
}

async function readRecentPeriodKeys(
  db: D1Database,
  menuId: string,
  excludeStart: string,
  excludeEnd: string,
  limit: number,
): Promise<PeriodKey[]> {
  const result = await db
    .prepare(`
      SELECT DISTINCT period_start, period_end
      FROM pouriq_stock_counts
      WHERE menu_id = ?1
        AND NOT (period_start = ?2 AND period_end = ?3)
      ORDER BY period_end DESC
      LIMIT ?4
    `)
    .bind(menuId, excludeStart, excludeEnd, limit)
    .all<PeriodKey>()
  return result.results ?? []
}

/**
 * Build VarianceRow[] for one menu + period.
 *
 * Steps:
 * 1. Read volumes for the period → Map<cocktail_id, units_sold>.
 * 2. Read recipes (bottle-priced ingredients only) → group by library_ingredient_id.
 * 3. Read existing stock counts for the period → Map<library_ingredient_id, counts>.
 * 4. For each unique library ingredient appearing on the menu's bottle-priced
 *    recipes OR with an existing count row, build a VarianceRow.
 *
 * Sorted by |variance_cost_p| descending, with all-null rows last.
 */
export async function loadVarianceRows(
  db: D1Database,
  menuId: string,
  periodStart: string,
  periodEnd: string,
): Promise<VarianceRow[]> {
  const [volumes, recipes, counts] = await Promise.all([
    readVolumes(db, menuId, periodStart, periodEnd),
    readRecipes(db, menuId),
    readCounts(db, menuId, periodStart, periodEnd),
  ])

  const volumesByCocktail = new Map<string, number>()
  for (const v of volumes) volumesByCocktail.set(v.cocktail_id, v.units_sold)

  const countsByIngredient = new Map<string, { start: number; end: number }>()
  for (const c of counts) {
    countsByIngredient.set(c.library_ingredient_id, { start: c.start_count, end: c.end_count })
  }

  // Group recipes by ingredient and also remember per-cocktail pour_ml for the calc.
  interface IngredientMeta {
    library_name: string
    pack_size: number
    price_p: number
    purchase_qty: number
  }
  const metaByIngredient = new Map<string, IngredientMeta>()
  const drinkIngredients = new Map<string, Array<{ library_id: string; pour_ml: number | null }>>()
  for (const r of recipes) {
    if (!metaByIngredient.has(r.library_ingredient_id)) {
      metaByIngredient.set(r.library_ingredient_id, {
        library_name: r.library_name,
        pack_size: r.pack_size,
        price_p: r.price_p,
        purchase_qty: r.purchase_qty,
      })
    }
    if (!drinkIngredients.has(r.cocktail_id)) drinkIngredients.set(r.cocktail_id, [])
    drinkIngredients.get(r.cocktail_id)!.push({
      library_id: r.library_ingredient_id,
      pour_ml: r.pour_ml,
    })
  }

  const drinks = Array.from(drinkIngredients.entries()).map(([cocktail_id, ingredients]) => ({
    cocktail_id,
    ingredients,
  }))

  // Include every ingredient that appears in the recipes OR has a count entered.
  const ingredientIds = new Set<string>(metaByIngredient.keys())
  for (const id of countsByIngredient.keys()) ingredientIds.add(id)

  const rows: VarianceRow[] = []
  for (const ingredient_id of ingredientIds) {
    const meta = metaByIngredient.get(ingredient_id)
    if (!meta) continue // count exists but ingredient no longer on any recipe; skip
    const theoretical_used_ml = calcTheoreticalUsedMl(ingredient_id, drinks, volumesByCocktail)
    const count = countsByIngredient.get(ingredient_id) ?? null
    const start_count = count?.start ?? null
    const end_count = count?.end ?? null
    const actual_used_ml = calcActualUsedMl(start_count, end_count, meta.pack_size)
    const { variance_ml, variance_pct } = calcVariance(actual_used_ml, theoretical_used_ml)
    const variance_cost_p = calcVarianceCostP(variance_ml, meta.pack_size, meta.price_p, meta.purchase_qty)
    rows.push({
      library_ingredient_id: ingredient_id,
      library_name: meta.library_name,
      pack_size: meta.pack_size,
      price_p: meta.price_p,
      start_count,
      end_count,
      theoretical_used_ml,
      actual_used_ml,
      variance_ml,
      variance_pct,
      variance_cost_p,
    })
  }

  // Sort: rows with a cost variance first (highest |£| descending), then
  // null-cost rows (no counts entered) at the bottom alphabetically.
  rows.sort((a, b) => {
    const aHas = a.variance_cost_p !== null
    const bHas = b.variance_cost_p !== null
    if (aHas && !bHas) return -1
    if (!aHas && bHas) return 1
    if (aHas && bHas) return Math.abs(b.variance_cost_p!) - Math.abs(a.variance_cost_p!)
    return a.library_name.localeCompare(b.library_name)
  })

  return rows
}

/**
 * Build the full variance payload: current period rows + recent periods
 * summary. The recent periods list returns up to N most recent periods
 * (other than the current one) where stock counts exist for this menu,
 * each with its total absolute cost variance.
 */
export async function loadVariancePayload(
  db: D1Database,
  menuId: string,
  periodStart: string,
  periodEnd: string,
  recentLimit: number = 5,
): Promise<VariancePayload> {
  const rows = await loadVarianceRows(db, menuId, periodStart, periodEnd)
  const recentKeys = await readRecentPeriodKeys(db, menuId, periodStart, periodEnd, recentLimit)

  const recent_periods: RecentVariancePeriod[] = []
  for (const k of recentKeys) {
    const pastRows = await loadVarianceRows(db, menuId, k.period_start, k.period_end)
    const total = pastRows.reduce(
      (sum, r) => sum + (r.variance_cost_p === null ? 0 : Math.abs(r.variance_cost_p)),
      0,
    )
    recent_periods.push({
      period_start: k.period_start,
      period_end: k.period_end,
      total_abs_cost_p: total,
    })
  }

  return {
    current_period: { start: periodStart, end: periodEnd },
    rows,
    recent_periods,
  }
}
