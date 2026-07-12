// "Needs attention" aggregator for the Pour IQ hub — pulls the signals a
// time-strapped operator should act on into one ordered list, scoped to the
// active menu for the menu-specific ones.

import type { MenuMetrics } from './types'
import { ingredientCompleteness } from './cost-confidence'
import { countUnmatched } from './pos/item-map'
import { listConnections } from './pos/connections'
import { getActiveMenu, listCocktailsForMenu } from './menus'
import { listVolumesForPeriod, currentPeriod } from './volumes'
import { calculateMenuMetrics } from './calculations'
import { isAlcoholicType } from './abv'

export interface AttentionRow {
  key: string
  label: string
  href: string
  severity: 'high' | 'medium'
}

// Pure: the menu-specific counts derived from computed metrics. Incomplete-cost
// drinks are never counted as under-target — their GP isn't trustworthy.
export function deriveMenuAttention(
  metrics: MenuMetrics,
  targetGpPct: number,
): { incompleteCostCount: number; underTargetCount: number } {
  const underTargetCount = metrics.cocktail_metrics.filter(
    (m) => m.cost_complete && m.sale_price_p > 0 && m.gp_pct < targetGpPct,
  ).length
  return { incompleteCostCount: metrics.incomplete_cost_count, underTargetCount }
}

const PROVIDER_LABELS: Record<string, string> = { square: 'Square', zettle: 'Zettle', sumup: 'SumUp' }

export async function getAttentionRows(db: D1Database, tradeAccountId: string): Promise<AttentionRow[]> {
  const [unmatched, connections, activeMenu] = await Promise.all([
    countUnmatched(db, tradeAccountId),
    listConnections(db, tradeAccountId),
    getActiveMenu(db, tradeAccountId),
  ])
  const rows: AttentionRow[] = []
  const enabled = connections.filter((c) => c.enabled === 1)

  // 1. Sales paused — a POS is connected but there's no active menu to route to.
  if (enabled.length > 0 && !activeMenu) {
    rows.push({ key: 'paused', label: 'Sales are paused — set an active menu', href: '/menus', severity: 'high' })
  }
  // 2. Sync errors, per connection.
  for (const c of connections) {
    if (c.last_sync_error) {
      rows.push({
        key: `sync-${c.provider}`,
        label: `${PROVIDER_LABELS[c.provider] ?? c.provider} sync error — reconnect`,
        href: '/settings/integrations',
        severity: 'high',
      })
    }
  }
  // 3. Unmatched till items.
  if (unmatched > 0) {
    rows.push({
      key: 'unmatched',
      label: `${unmatched} unmatched till ${unmatched === 1 ? 'item' : 'items'} — sales not counting`,
      href: '/unmatched',
      severity: 'medium',
    })
  }
  // 4 & 5. Active-menu cost/GP signals.
  if (activeMenu) {
    const period = currentPeriod(activeMenu.volume_cadence)
    const [cocktails, volumes] = await Promise.all([
      listCocktailsForMenu(db, activeMenu.id),
      listVolumesForPeriod(db, activeMenu.id, period.start, period.end),
    ])
    const metrics = calculateMenuMetrics(cocktails, activeMenu.prices_include_vat === 1, volumes)
    const { incompleteCostCount, underTargetCount } = deriveMenuAttention(metrics, activeMenu.target_gp_pct)
    if (incompleteCostCount > 0) {
      rows.push({
        key: 'prices',
        label: `${incompleteCostCount} drink${incompleteCostCount === 1 ? '' : 's'} need prices on ${activeMenu.name}`,
        href: `/${activeMenu.id}`,
        severity: 'medium',
      })
    }
    const estimatedIngCount = new Set(
      cocktails
        .flatMap((c) => c.ingredients)
        .filter((i) => i.library.cost_confidence === 'estimated')
        .map((i) => i.library_ingredient_id),
    ).size
    if (estimatedIngCount > 0) {
      rows.push({
        key: 'estimated-costs',
        label: `${estimatedIngCount} ingredient${estimatedIngCount === 1 ? '' : 's'} ${estimatedIngCount === 1 ? 'has' : 'have'} estimated costs. Scan an invoice to confirm.`,
        href: '/invoices',
        severity: 'medium',
      })
    }
    const incompleteIngCount = new Set(
      cocktails
        .flatMap((c) => c.ingredients)
        .filter((i) => !ingredientCompleteness(i.library).complete)
        .map((i) => i.library_ingredient_id),
    ).size
    if (incompleteIngCount > 0) {
      rows.push({
        key: 'incomplete-ingredients',
        label: `${incompleteIngCount} ingredient${incompleteIngCount === 1 ? '' : 's'} ${incompleteIngCount === 1 ? 'is' : 'are'} missing cost details.`,
        href: '/library',
        severity: 'medium',
      })
    }
    const unreviewedIngCount = new Set(
      cocktails
        .flatMap((c) => c.ingredients)
        .filter((i) => i.library.allergens_reviewed === 0)
        .map((i) => i.library_ingredient_id),
    ).size
    if (unreviewedIngCount > 0) {
      rows.push({
        key: 'allergen-review',
        label: `${unreviewedIngCount} ingredient${unreviewedIngCount === 1 ? '' : 's'} need${unreviewedIngCount === 1 ? 's' : ''} an allergen review.`,
        href: '/library',
        severity: 'medium',
      })
    }
    const needsAbvCount = new Set(
      cocktails
        .flatMap((c) => c.ingredients)
        .filter((i) => isAlcoholicType(i.library.ingredient_type) && i.library.abv === 0)
        .map((i) => i.library_ingredient_id),
    ).size
    if (needsAbvCount > 0) {
      rows.push({
        key: 'abv-missing',
        label: `${needsAbvCount} alcoholic ingredient${needsAbvCount === 1 ? '' : 's'} need${needsAbvCount === 1 ? 's' : ''} an ABV.`,
        href: '/library',
        severity: 'medium',
      })
    }
    if (underTargetCount > 0) {
      rows.push({
        key: 'gp',
        label: `${underTargetCount} drink${underTargetCount === 1 ? '' : 's'} under target GP on ${activeMenu.name}`,
        href: `/${activeMenu.id}`,
        severity: 'medium',
      })
    }
  }
  return rows
}
