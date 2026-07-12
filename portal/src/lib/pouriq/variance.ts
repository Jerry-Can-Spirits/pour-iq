// Pure deterministic helpers for variance tracking. No DB access, no
// side effects. Used by the server-side loader to build VarianceRow[]
// for the menu page's variance editor.

import { costPerMlP } from './calculations'

export interface VarianceRow {
  library_ingredient_id: string
  library_name: string
  pack_size: number                    // for display context (e.g. "Smirnoff (700ml)")
  price_p: number                      // net of VAT, from library

  // Stock count input (null when the manager hasn't entered yet)
  start_count: number | null
  end_count: number | null

  // Calculated (null when inputs missing or theoretical is zero)
  theoretical_used_ml: number
  actual_used_ml: number | null
  variance_ml: number | null
  variance_pct: number | null          // null when theoretical is zero (undefined % against a zero base)
  variance_cost_p: number | null
}

/**
 * Theoretical millilitres used of one ingredient across all drinks on
 * a menu, given recipes and per-cocktail sales volumes. Unit-priced
 * contributions (unit_count, pour_ml null) are excluded — variance
 * lite tracks bottle-priced only.
 */
export function calcTheoreticalUsedMl(
  ingredient_id: string,
  drinks: Array<{
    cocktail_id: string
    ingredients: Array<{ library_id: string; pour_ml: number | null }>
  }>,
  volumesByCocktail: Map<string, number>,
): number {
  let total = 0
  for (const drink of drinks) {
    const units = volumesByCocktail.get(drink.cocktail_id) ?? 0
    if (units === 0) continue
    for (const ing of drink.ingredients) {
      if (ing.library_id !== ingredient_id) continue
      if (ing.pour_ml === null) continue
      total += units * ing.pour_ml
    }
  }
  return total
}

/**
 * Actual millilitres used from start/end bottle counts. Returns null
 * if either count is missing — caller decides how to render that.
 */
export function calcActualUsedMl(
  start: number | null,
  end: number | null,
  pack_size: number,
): number | null {
  if (start === null || end === null) return null
  return (start - end) * pack_size
}

/**
 * Variance derives from actual − theoretical. Percentage is null when
 * theoretical is zero (no sales to compare against).
 */
export function calcVariance(
  actual_ml: number | null,
  theoretical_ml: number,
): { variance_ml: number | null; variance_pct: number | null } {
  if (actual_ml === null) return { variance_ml: null, variance_pct: null }
  const variance_ml = actual_ml - theoretical_ml
  if (theoretical_ml === 0) return { variance_ml, variance_pct: null }
  const variance_pct = (variance_ml / theoretical_ml) * 100
  return { variance_ml, variance_pct }
}

/**
 * Cash cost of variance: variance_ml × per-ml cost (purchase_qty-aware).
 * Positive = money out (overpour); negative = money "back" (under-pour
 * or sales misreport). Rounded to whole pence to keep with the rest
 * of pouriq's integer-pence convention.
 */
export function calcVarianceCostP(
  variance_ml: number | null,
  pack_size: number,
  price_p: number,
  purchase_qty: number,
): number | null {
  if (variance_ml === null) return null
  return Math.round(variance_ml * costPerMlP(price_p, pack_size, purchase_qty))
}

export type VarianceSeverity = 'none' | 'within-tolerance' | 'amber' | 'red'

// Eyeballing a partial bottle is only accurate to roughly a fifth of a bottle,
// so anything smaller is measurement noise, not loss.
export const VARIANCE_TOLERANCE_BOTTLES = 0.2

/**
 * Classify a variance for display. Absolute variances within the counting
 * noise floor (≈0.2 of a bottle) — or small percentages — are "within
 * tolerance" and should not be flagged as a figure, so staff aren't trained
 * to ignore an always-red report. Beyond that: amber to 20%, red above.
 */
export function classifyVariance(
  variance_ml: number | null,
  variance_pct: number | null,
  pack_size: number,
): VarianceSeverity {
  if (variance_ml === null) return 'none'
  if (Math.abs(variance_ml) <= VARIANCE_TOLERANCE_BOTTLES * pack_size) return 'within-tolerance'
  if (variance_pct === null) return 'amber'
  const abs = Math.abs(variance_pct)
  if (abs < 10) return 'within-tolerance'
  if (abs <= 20) return 'amber'
  return 'red'
}

export interface CountEvent {
  counted_at: string
  count_qty: number
  reason: string | null
}

export interface CountPair {
  latest: CountEvent
  previous: CountEvent
}

// The two most recent counts (by counted_at), or null if fewer than two.
export function pairLatestCounts(events: CountEvent[]): CountPair | null {
  if (events.length < 2) return null
  const sorted = [...events].sort((a, b) => a.counted_at.localeCompare(b.counted_at))
  return { latest: sorted[sorted.length - 1], previous: sorted[sorted.length - 2] }
}

// Sum POS units for buckets whose period falls within (windowStart, windowEnd].
// windowStart/windowEnd are ISO date strings (YYYY-MM-DD). Bucket boundaries
// are the cadence period_start/period_end. Exact when counts land on the
// cadence boundary, approximate mid-bucket (accepted caveat).
export function sumBucketsInWindow(
  buckets: Array<{ period_start: string; period_end: string; units_sold: number }>,
  windowStart: string,
  windowEnd: string,
): number {
  return buckets.reduce(
    (sum, b) => (b.period_start > windowStart && b.period_end <= windowEnd ? sum + b.units_sold : sum),
    0,
  )
}

// Expected real-world usage from raw poured ml, accounting for line/keg wastage.
// yield_pct 100 = no loss (no-op). Lower yield means more is drawn down per ml sold.
export function applyYield(rawMl: number, yieldPct: number): number {
  const y = yieldPct > 0 ? yieldPct : 100
  return rawMl / (y / 100)
}

// Persistent shrinkage: the most recent 3 variance figures are all negative.
export function persistentLossFlag(recentVariancesNewestLast: Array<number | null>): boolean {
  const defined = recentVariancesNewestLast.filter((v): v is number => v !== null)
  if (defined.length < 3) return false
  const lastThree = defined.slice(-3)
  return lastThree.every((v) => v < 0)
}

// Canonicalise a stored timestamp for lexical window comparison. Counts and
// production are space-form "YYYY-MM-DD HH:MM:SS"; stock receipts may be ISO
// ("...THH:MM:SS.sssZ") or date-only. Convert all to space-form at seconds
// precision so ordering is correct across the formats (without this, the ISO
// "T" sorts after a space and a same-day delivery falls out of its window).
export function canonTs(s: string): string {
  return s.replace('T', ' ').slice(0, 19)
}

// Rows whose timestamp is strictly after `ws` and up to and including `we`.
function inWindow(at: string, ws: string, we: string): boolean {
  const a = canonTs(at)
  return a > canonTs(ws) && a <= canonTs(we)
}

// Sum amounts in the window (ws, we]. Used to fold deliveries and production
// into the variance count window.
export function sumAmountsInWindow(
  rows: Array<{ amount: number; at: string }>,
  ws: string,
  we: string,
): number {
  let total = 0
  for (const r of rows) if (inWindow(r.at, ws, we)) total += r.amount
  return total
}

// Count of rows in the window (ws, we] — shares the boundary logic with
// sumAmountsInWindow so a count can never diverge from its sum.
export function countInWindow(rows: Array<{ at: string }>, ws: string, we: string): number {
  let n = 0
  for (const r of rows) if (inWindow(r.at, ws, we)) n++
  return n
}

export interface VarianceLedger {
  opening_bottles: number
  deliveries_bottles: number
  produced_bottles: number
  consumed_bottles: number
  expected_usage_bottles: number
  expected_closing_bottles: number
  actual_closing_bottles: number
  variance_bottles: number // expected closing − actual closing; positive = unexplained loss
}

// Reconciles the bottle-denominated stock identity for the variance detail
// ledger: opening + deliveries + produced − consumed − expected usage = expected
// closing; the gap to the actual count is the unexplained variance. Same terms
// as the rolling loader's actual-usage fold, just shown as a transparent ledger.
export function buildVarianceLedger(input: {
  openingQty: number
  closingQty: number
  deliveriesBottles: number
  producedBottles: number
  consumedBottles: number
  expectedUsageBottles: number
}): VarianceLedger {
  const expected_closing =
    input.openingQty + input.deliveriesBottles + input.producedBottles - input.consumedBottles - input.expectedUsageBottles
  return {
    opening_bottles: input.openingQty,
    deliveries_bottles: input.deliveriesBottles,
    produced_bottles: input.producedBottles,
    consumed_bottles: input.consumedBottles,
    expected_usage_bottles: input.expectedUsageBottles,
    expected_closing_bottles: expected_closing,
    actual_closing_bottles: input.closingQty,
    variance_bottles: expected_closing - input.closingQty,
  }
}

/**
 * Theoretical purchase units of a produce ingredient consumed across
 * a period. Each drink contributes recipeQty of the raw ingredient,
 * converted to purchase units via the use yield (yieldQty per
 * purchase unit). Guards a zero/negative yield (e.g. unset) by
 * returning 0 so callers get a safe no-op rather than Infinity.
 */
export function produceLineUnits(unitsSold: number, recipeQty: number, yieldQty: number): number {
  if (yieldQty <= 0) return 0
  return unitsSold * (recipeQty / yieldQty)
}

export interface ReasonSummaryRow { reason: string; loss_p: number; share_pct: number }
export interface VarianceReasonSummary { rows: ReasonSummaryRow[]; total_loss_p: number }

// Aggregate this period's variance LOSSES (negative cost) by their reason code,
// with an 'unattributed' bucket for losses that have no reason set. Surpluses
// (variance_cost_p >= 0) are excluded. Pure: operates on the minimal row shape
// so the client variance editor and unit tests can both call it.
export function summariseVarianceByReason(
  rows: Array<{ variance_cost_p: number | null; latest_reason: string | null }>,
): VarianceReasonSummary {
  const byReason = new Map<string, number>()
  let total = 0
  for (const r of rows) {
    const v = r.variance_cost_p
    if (v == null || v >= 0) continue
    const loss = -v
    total += loss
    const key = r.latest_reason && r.latest_reason.trim() !== '' ? r.latest_reason : 'unattributed'
    byReason.set(key, (byReason.get(key) ?? 0) + loss)
  }
  if (total === 0) return { rows: [], total_loss_p: 0 }
  // Largest-remainder allocation so the shares sum to exactly 100 (plain
  // per-row rounding can give a 99% or 101% column that reads as a bug).
  const parts = Array.from(byReason.entries()).map(([reason, loss_p]) => {
    const raw = (loss_p / total) * 100
    return { reason, loss_p, share_pct: Math.floor(raw), rem: raw - Math.floor(raw) }
  })
  let remaining = 100 - parts.reduce((s, p) => s + p.share_pct, 0)
  for (const p of [...parts].sort((a, b) => b.rem - a.rem || b.loss_p - a.loss_p)) {
    if (remaining <= 0) break
    p.share_pct += 1
    remaining -= 1
  }
  const out: ReasonSummaryRow[] = parts.map(({ reason, loss_p, share_pct }) => ({ reason, loss_p, share_pct }))
  out.sort((a, b) => {
    if (a.reason === 'unattributed') return 1
    if (b.reason === 'unattributed') return -1
    return b.loss_p - a.loss_p || a.reason.localeCompare(b.reason)
  })
  return { rows: out, total_loss_p: total }
}
