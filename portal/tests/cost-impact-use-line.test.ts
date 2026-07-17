import { describe, it, expect } from 'vitest'
import { rowContributionP } from '../src/lib/pouriq/cost-impact-loader'
import { contributionP } from '../src/lib/pouriq/multi-cost-impact'
import { ingredientCostPence } from '../src/lib/pouriq/calculations'
import type { IngredientWithLibrary } from '../src/lib/pouriq/types'

// H2 regression. The cost-ripple loaders once read only pour_ml/unit_count, so
// a produce "use" line (fresh juice, syrup, garnish) cost 0 in the ripple —
// understating pour cost, overstating GP, and mis-firing the below-target flag
// that gates a price save, while calculations.ts costed the same line correctly.
// These lock both ripple loaders to ingredientCostPence for a use line, so the
// two cannot silently diverge again.
describe('cost-ripple use-line parity with calculations.ts', () => {
  // 25ml fresh lime juice: a lime costs 30p (base_unit each), yields 30ml, and
  // the recipe uses 25ml → 25p (lineCostFromUseP's worked example).
  const price_p = 30
  const purchase_qty = 1
  const pack_size = 1
  const yield_pct = 100
  const use_yield_qty = 30
  const recipe_qty = 25

  const ingredient: IngredientWithLibrary = {
    id: 'ing-1',
    cocktail_id: 'ck-1',
    library_ingredient_id: 'lib-lime',
    pour_ml: null,
    unit_count: null,
    recipe_unit: 'ml',
    recipe_qty,
    use_id: 'use-1',
    use: {
      id: 'use-1',
      ingredient_id: 'lib-lime',
      name: 'Lime juice',
      recipe_unit: 'ml',
      yield_qty: use_yield_qty,
      position: 0,
      created_at: '',
    },
    library: {
      id: 'lib-lime',
      trade_account_id: 't1',
      name: 'Lime',
      ingredient_type: 'juice',
      base_unit: 'each',
      pack_size,
      price_p,
      price_includes_vat: 0,
      price_entered_p: null,
      pack_format: null,
      subcategory: null,
      is_prepared: 0,
      purchase_qty,
      yield_pct,
      barcode: null,
      notes: null,
      cost_confidence: 'estimated',
      created_at: '',
      updated_at: '',
      allergens: '',
      dietary: '',
      allergens_reviewed: 0,
      abv: 0,
    },
  }

  const canonical = ingredientCostPence(ingredient)

  const row = {
    lib_price_p: price_p,
    lib_purchase_qty: purchase_qty,
    lib_pack_size: pack_size,
    lib_yield_pct: yield_pct,
    lib_base_unit: 'each' as const,
    ingredient_pour_ml: null,
    ingredient_unit_count: null,
    ingredient_use_id: 'use-1',
    ingredient_recipe_qty: recipe_qty,
    use_yield_qty,
  }

  it('canonical use-line cost is non-zero (the pre-fix ripple returned 0)', () => {
    expect(canonical).toBe(25)
  })

  it('single-cost ripple contribution equals the canonical cost', () => {
    expect(rowContributionP(row)).toBe(canonical)
  })

  it('multi-cost ripple contribution equals the canonical cost', () => {
    expect(contributionP(row, price_p)).toBe(canonical)
  })
})
