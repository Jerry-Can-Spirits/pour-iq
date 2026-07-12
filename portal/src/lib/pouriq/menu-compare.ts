// Pure helpers for comparing two menus. Caller provides both menus'
// cocktails + computed metrics; we return a structured diff that the
// UI can render directly.

import type { CocktailMetrics, CocktailRow, MenuRow } from './types'

function normaliseName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

export interface CompareInput {
  menu: MenuRow
  cocktails: CocktailRow[]
  metrics: CocktailMetrics[]
}

export interface CompareSummary {
  cocktail_count: number
  avg_gp_pct: number
  total_margin_p: number
  total_contribution_p: number  // 0 if no volumes
}

export interface SharedDrinkDiff {
  cocktail_name: string
  a: { sale_price_p: number; pour_cost_p: number; gp_pct: number; margin_p: number; contribution_p: number | null }
  b: { sale_price_p: number; pour_cost_p: number; gp_pct: number; margin_p: number; contribution_p: number | null }
  // Convenience deltas (b - a). Useful for UI sorting / colouring.
  delta_sale_price_p: number
  delta_pour_cost_p: number
  delta_gp_pct: number
  delta_margin_p: number
  delta_contribution_p: number | null
}

export interface UniqueDrink {
  cocktail_name: string
  sale_price_p: number
  gp_pct: number
  margin_p: number
  contribution_p: number | null
}

export interface MenuComparison {
  a_summary: CompareSummary
  b_summary: CompareSummary
  shared: SharedDrinkDiff[]
  only_in_a: UniqueDrink[]  // present in A, missing from B
  only_in_b: UniqueDrink[]  // present in B, missing from A
}

function summarise(input: CompareInput): CompareSummary {
  const cocktail_count = input.metrics.length
  const valid = input.metrics.filter((m) => m.sale_price_p > 0)
  const avg_gp_pct = valid.length === 0
    ? 0
    : Math.round((valid.reduce((s, m) => s + m.gp_pct, 0) / valid.length) * 10) / 10
  const total_margin_p = input.metrics.reduce((s, m) => s + m.margin_p, 0)
  const total_contribution_p = input.metrics.reduce((s, m) => s + (m.volume?.contribution_p ?? 0), 0)
  return { cocktail_count, avg_gp_pct, total_margin_p, total_contribution_p }
}

export function compareMenus(a: CompareInput, b: CompareInput): MenuComparison {
  // Index B by normalised name for shared / unique partition.
  const byCocktailId = new Map(b.cocktails.map((c) => [c.id, c]))
  const bMetricByCocktailId = new Map(b.metrics.map((m) => [m.cocktail_id, m]))
  const bByName = new Map<string, { c: CocktailRow; m: CocktailMetrics }>()
  for (const c of b.cocktails) {
    const m = bMetricByCocktailId.get(c.id)
    if (m) bByName.set(normaliseName(c.name), { c, m })
  }

  const aMetricByCocktailId = new Map(a.metrics.map((m) => [m.cocktail_id, m]))
  const aSeenNames = new Set<string>()
  const shared: SharedDrinkDiff[] = []
  const only_in_a: UniqueDrink[] = []

  for (const aCocktail of a.cocktails) {
    const aMetric = aMetricByCocktailId.get(aCocktail.id)
    if (!aMetric) continue
    const key = normaliseName(aCocktail.name)
    aSeenNames.add(key)
    const match = bByName.get(key)
    if (!match) {
      only_in_a.push({
        cocktail_name: aCocktail.name,
        sale_price_p: aMetric.sale_price_p,
        gp_pct: aMetric.gp_pct,
        margin_p: aMetric.margin_p,
        contribution_p: aMetric.volume?.contribution_p ?? null,
      })
      continue
    }
    const bMetric = match.m
    const aContribution = aMetric.volume?.contribution_p ?? null
    const bContribution = bMetric.volume?.contribution_p ?? null
    const deltaContribution =
      aContribution !== null && bContribution !== null
        ? bContribution - aContribution
        : null
    shared.push({
      cocktail_name: aCocktail.name,
      a: {
        sale_price_p: aMetric.sale_price_p,
        pour_cost_p: aMetric.pour_cost_p,
        gp_pct: aMetric.gp_pct,
        margin_p: aMetric.margin_p,
        contribution_p: aContribution,
      },
      b: {
        sale_price_p: bMetric.sale_price_p,
        pour_cost_p: bMetric.pour_cost_p,
        gp_pct: bMetric.gp_pct,
        margin_p: bMetric.margin_p,
        contribution_p: bContribution,
      },
      delta_sale_price_p: bMetric.sale_price_p - aMetric.sale_price_p,
      delta_pour_cost_p: bMetric.pour_cost_p - aMetric.pour_cost_p,
      delta_gp_pct: Math.round((bMetric.gp_pct - aMetric.gp_pct) * 10) / 10,
      delta_margin_p: bMetric.margin_p - aMetric.margin_p,
      delta_contribution_p: deltaContribution,
    })
  }

  const only_in_b: UniqueDrink[] = []
  for (const bCocktail of b.cocktails) {
    const key = normaliseName(bCocktail.name)
    if (aSeenNames.has(key)) continue
    const bMetric = bMetricByCocktailId.get(bCocktail.id)
    if (!bMetric) continue
    only_in_b.push({
      cocktail_name: bCocktail.name,
      sale_price_p: bMetric.sale_price_p,
      gp_pct: bMetric.gp_pct,
      margin_p: bMetric.margin_p,
      contribution_p: bMetric.volume?.contribution_p ?? null,
    })
  }

  // Sort shared by largest absolute GP swing so the headline changes
  // surface first.
  shared.sort((x, y) => Math.abs(y.delta_gp_pct) - Math.abs(x.delta_gp_pct))

  return {
    a_summary: summarise(a),
    b_summary: summarise(b),
    shared,
    only_in_a,
    only_in_b,
  }
  // byCocktailId is unused at the moment but kept in scope to make
  // future per-cocktail drill-downs easy.
  void byCocktailId
}
