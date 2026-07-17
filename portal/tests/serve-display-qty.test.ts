import { describe, it, expect } from 'vitest'
import { serveDisplayQty } from '../src/lib/pouriq/measures'

// Regression: the drink edit form (ServeUnitPicker) read only recipe_qty, so
// imported drinks — whose measure is stored in the legacy pour_ml/unit_count
// fields with recipe_qty null — rendered "0". serveDisplayQty gives the edit
// form the same legacy fallback the spec card (formatServeMeasure) already has.
describe('serveDisplayQty — edit-form amount for imported rows', () => {
  it('imported ml row (pour_ml set, recipe_qty null) shows the pour_ml amount', () => {
    // The Signal Box case: Bourbon 60ml must render 60, not 0.
    expect(serveDisplayQty(null, 'ml', 60, null)).toBe(60)
  })

  it('imported each row (unit_count set, recipe_qty null) shows the unit_count', () => {
    expect(serveDisplayQty(null, 'each', null, 1)).toBe(1)
  })

  it('a new-style row prefers recipe_qty over the legacy fields', () => {
    expect(serveDisplayQty(25, 'ml', 25, null)).toBe(25)
  })

  it('an empty row falls through to 0', () => {
    expect(serveDisplayQty(null, 'ml', null, null)).toBe(0)
  })
})
