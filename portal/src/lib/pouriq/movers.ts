// Top / slow / dead-stock by POS sales over a trailing window. Pure: ranks
// cocktails by units sold in the last N days, with a not-selling bucket for
// menu rationalisation. Popularity threshold mirrors menu-performance.ts so
// the movers list and the menu-engineering matrix agree on "popular" — the
// only difference is movers ranks WINDOWED units (last 30 days) where the
// matrix uses all-time units, so the two splits can differ by design.

export interface MoverEntry { cocktail_id: string; name: string; units: number; last_sold: string | null }
export interface MoversReport {
  window_days: number
  has_sales: boolean
  top_sellers: MoverEntry[]
  slow_sellers: MoverEntry[]
  not_selling: MoverEntry[]
}

function cutoffDate(now: Date, windowDays: number): string {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() - windowDays)
  return d.toISOString().slice(0, 10)
}

export function buildMoversReport(
  cocktails: Array<{ id: string; name: string }>,
  volumes: Array<{ cocktail_id: string; period_end: string; units_sold: number }>,
  now: Date = new Date(),
  windowDays = 30,
): MoversReport {
  const cutoff = cutoffDate(now, windowDays)
  const windowUnits = new Map<string, number>()
  const lastSold = new Map<string, string>()
  let everSold = false
  for (const v of volumes) {
    if (v.units_sold > 0) {
      everSold = true
      const prev = lastSold.get(v.cocktail_id)
      if (!prev || v.period_end > prev) lastSold.set(v.cocktail_id, v.period_end)
    }
    if (v.period_end >= cutoff) {
      windowUnits.set(v.cocktail_id, (windowUnits.get(v.cocktail_id) ?? 0) + v.units_sold)
    }
  }

  const entries: MoverEntry[] = cocktails.map((c) => ({
    cocktail_id: c.id,
    name: c.name,
    units: windowUnits.get(c.id) ?? 0,
    last_sold: lastSold.get(c.id) ?? null,
  }))

  if (!everSold) {
    return { window_days: windowDays, has_sales: false, top_sellers: [], slow_sellers: [], not_selling: [] }
  }

  const totalWindow = entries.reduce((s, e) => s + e.units, 0)
  const threshold = cocktails.length > 0 ? 0.7 * (totalWindow / cocktails.length) : 0

  const top_sellers: MoverEntry[] = []
  const slow_sellers: MoverEntry[] = []
  const not_selling: MoverEntry[] = []
  for (const e of entries) {
    if (e.units === 0) not_selling.push(e)
    else if (e.units >= threshold) top_sellers.push(e)
    else slow_sellers.push(e)
  }

  const byUnitsDesc = (a: MoverEntry, b: MoverEntry) => b.units - a.units || a.name.localeCompare(b.name)
  top_sellers.sort(byUnitsDesc)
  slow_sellers.sort(byUnitsDesc)
  // Cut candidates first: longest without a sale, then never-sold, then name.
  not_selling.sort((a, b) => {
    if (a.last_sold == null && b.last_sold == null) return a.name.localeCompare(b.name)
    if (a.last_sold == null) return 1
    if (b.last_sold == null) return -1
    return a.last_sold.localeCompare(b.last_sold) || a.name.localeCompare(b.name)
  })

  return { window_days: windowDays, has_sales: true, top_sellers, slow_sellers, not_selling }
}
