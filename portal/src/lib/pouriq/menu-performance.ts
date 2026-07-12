// Menu-engineering classification: place each drink on popularity (sales vs a
// 70%-of-average threshold) × profitability (GP% vs the menu target), in plain
// words. Pure re-render of cocktail metrics — no DB, no new data.

import type { CocktailMetrics } from './types'

export type PerfStatus =
  | 'winner' | 'promote' | 'fix-margin' | 'review' // full quadrant (sales present)
  | 'good-margin' | 'thin-margin' // profitability-only (no sales yet)
  | 'missing-cost' | 'needs-price' // data flags (take precedence)

export const STATUS_LABEL: Record<PerfStatus, string> = {
  winner: 'Winner',
  promote: 'Promote',
  'fix-margin': 'Fix the margin',
  review: 'Review or cut',
  'good-margin': 'Good margin',
  'thin-margin': 'Thin margin',
  'missing-cost': 'Missing cost data',
  'needs-price': 'Needs a price',
}

export function classifyDrinkPerformance(
  m: CocktailMetrics,
  ctx: { targetGpPct: number; popularityThreshold: number; hasSales: boolean },
): PerfStatus {
  if (m.sale_price_p <= 0) return 'needs-price'
  if (!m.cost_complete) return 'missing-cost'
  const goodMargin = m.gp_pct >= ctx.targetGpPct
  if (!ctx.hasSales) return goodMargin ? 'good-margin' : 'thin-margin'
  const popular = (m.volume?.units_sold ?? 0) >= ctx.popularityThreshold
  if (goodMargin) return popular ? 'winner' : 'promote'
  return popular ? 'fix-margin' : 'review'
}

export interface MenuPerformance {
  hasSales: boolean
  statusById: Record<string, PerfStatus>
  quadrants: { winner: CocktailMetrics[]; promote: CocktailMetrics[]; fixMargin: CocktailMetrics[]; review: CocktailMetrics[] }
}

export function buildMenuPerformance(metrics: CocktailMetrics[], targetGpPct: number): MenuPerformance {
  const totalUnits = metrics.reduce((s, m) => s + (m.volume?.units_sold ?? 0), 0)
  const hasSales = totalUnits > 0
  // 70% of an equal share of total sales = "sells at least 70% of an average drink".
  const popularityThreshold = metrics.length > 0 ? 0.7 * (totalUnits / metrics.length) : 0

  const statusById: Record<string, PerfStatus> = {}
  const quadrants: MenuPerformance['quadrants'] = { winner: [], promote: [], fixMargin: [], review: [] }
  for (const m of metrics) {
    const status = classifyDrinkPerformance(m, { targetGpPct, popularityThreshold, hasSales })
    statusById[m.cocktail_id] = status
    if (status === 'winner') quadrants.winner.push(m)
    else if (status === 'promote') quadrants.promote.push(m)
    else if (status === 'fix-margin') quadrants.fixMargin.push(m)
    else if (status === 'review') quadrants.review.push(m)
  }
  return { hasSales, statusById, quadrants }
}
