export type MenuBalanceGroupKey =
  | 'strong'
  | 'popular-low-margin'
  | 'high-margin-low-sales'
  | 'underperformers'

export interface MenuBalanceDrink {
  id: string
  name: string
  gp_pct: number
  units: number
}

export interface MenuBalanceResult {
  groups: Record<MenuBalanceGroupKey, MenuBalanceDrink[]>
  marginThreshold: number
  popularityThreshold: number
  totalUnits: number
  includedCount: number
}

// Plain, action-oriented labels (deliberately not the textbook stars/dogs jargon).
export const MENU_BALANCE_LABELS: Record<MenuBalanceGroupKey, { title: string; action: string }> = {
  strong: { title: 'Strong sellers', action: 'Keep them front and centre.' },
  'popular-low-margin': { title: 'Popular, low margin', action: 'Re-cost or nudge the price.' },
  'high-margin-low-sales': { title: 'High margin, low sales', action: 'Give them more visibility.' },
  underperformers: { title: 'Underperformers', action: 'Review or drop.' },
}

// Render order, best to worst.
export const MENU_BALANCE_ORDER: MenuBalanceGroupKey[] = [
  'strong',
  'popular-low-margin',
  'high-margin-low-sales',
  'underperformers',
]

// `drinks` must already be filtered to INCLUDED drinks (cost-complete and priced).
// Margin split = target GP% (or average GP% when no target). Popularity split =
// 70% of fair share (total units / drink count) so one big seller does not skew it.
export function classifyMenuBalance(
  drinks: MenuBalanceDrink[],
  opts: { targetGpPct: number | null; avgGpPct: number },
): MenuBalanceResult {
  const includedCount = drinks.length
  const totalUnits = drinks.reduce((sum, d) => sum + d.units, 0)
  const marginThreshold = opts.targetGpPct && opts.targetGpPct > 0 ? opts.targetGpPct : opts.avgGpPct
  const fairShare = includedCount > 0 ? totalUnits / includedCount : 0
  const popularityThreshold = 0.7 * fairShare

  const groups: Record<MenuBalanceGroupKey, MenuBalanceDrink[]> = {
    strong: [],
    'popular-low-margin': [],
    'high-margin-low-sales': [],
    underperformers: [],
  }
  for (const d of drinks) {
    const highMargin = d.gp_pct >= marginThreshold
    const popular = d.units >= popularityThreshold
    const key: MenuBalanceGroupKey = highMargin
      ? popular ? 'strong' : 'high-margin-low-sales'
      : popular ? 'popular-low-margin' : 'underperformers'
    groups[key].push(d)
  }
  return { groups, marginThreshold, popularityThreshold, totalUnits, includedCount }
}
