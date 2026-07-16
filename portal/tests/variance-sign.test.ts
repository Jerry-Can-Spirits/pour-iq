import { describe, it, expect } from 'vitest'
import {
  calcVariance,
  summariseVarianceByReason,
  persistentLossFlag,
} from '../src/lib/pouriq/variance'

// Locks the variance sign convention: a POSITIVE variance is a loss — more was
// used than sales explain (money out / overpour, per calcVarianceCostP's doc).
// This convention inverted in three display consumers once (the reason
// summary, the persistent-loss flag, and the trend colour all treated negative
// as loss), showing surpluses as losses and hiding real ones. These assertions
// fail if it inverts again.
describe('variance loss-sign convention', () => {
  it('over-usage is a positive variance (loss), under-usage negative (surplus)', () => {
    // Consumed 2800ml against 2100ml of sales → 700ml more used than expected.
    expect(calcVariance(2800, 2100).variance_ml).toBe(700)
    expect(calcVariance(1800, 2100).variance_ml).toBe(-300)
  })

  it('summariseVarianceByReason counts positive costs as losses, excludes surpluses', () => {
    const summary = summariseVarianceByReason([
      { variance_cost_p: 500, latest_reason: 'wastage' }, // loss
      { variance_cost_p: -300, latest_reason: 'miscount' }, // surplus — excluded
      { variance_cost_p: 200, latest_reason: null }, // loss, unattributed
    ])
    expect(summary.total_loss_p).toBe(700)
    const byReason = Object.fromEntries(summary.rows.map((r) => [r.reason, r.loss_p]))
    expect(byReason.wastage).toBe(500)
    expect(byReason.unattributed).toBe(200)
    expect(byReason.miscount).toBeUndefined()
  })

  it('persistentLossFlag fires on three consecutive losses, not surpluses', () => {
    expect(persistentLossFlag([100, 200, 300])).toBe(true) // three losses
    expect(persistentLossFlag([-100, -200, -300])).toBe(false) // three surpluses
    expect(persistentLossFlag([100, -200, 300])).toBe(false) // mixed
    expect(persistentLossFlag([100, 200])).toBe(false) // too few
  })
})
