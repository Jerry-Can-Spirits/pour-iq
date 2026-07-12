import type { CostConfidence } from './types'

export function ingredientCompleteness(
  row: { price_p: number; pack_size: number; purchase_qty: number; is_prepared: number },
): { complete: boolean; missing: string[] } {
  const missing: string[] = []
  if (row.price_p <= 0) missing.push('price')
  if (!row.is_prepared) {
    if (row.pack_size <= 0) missing.push('pack size')
    if (row.purchase_qty <= 0) missing.push('purchase quantity')
  }
  return { complete: missing.length === 0, missing }
}

export function costConfidenceBadge(c: CostConfidence): { label: string; className: string } {
  switch (c) {
    case 'confirmed': return { label: 'Confirmed', className: 'bg-emerald-50 text-emerald-700 border border-emerald-600' }
    case 'set': return { label: 'Set', className: 'bg-slate-100 text-slate-600 border border-slate-300' }
    default: return { label: 'Estimated', className: 'bg-amber-50 text-amber-700 border border-amber-500' }
  }
}

// A drink is "unconfirmed" if any ingredient is not confirmed; "estimated" if any is estimated.
export function menuCostConfidence(
  cocktails: { ingredients: { library: { cost_confidence: CostConfidence } }[] }[],
): { unconfirmed_drinks: number; estimated_drinks: number } {
  let unconfirmed_drinks = 0
  let estimated_drinks = 0
  for (const c of cocktails) {
    if (c.ingredients.length === 0) continue
    if (c.ingredients.some((i) => i.library.cost_confidence !== 'confirmed')) unconfirmed_drinks++
    if (c.ingredients.some((i) => i.library.cost_confidence === 'estimated')) estimated_drinks++
  }
  return { unconfirmed_drinks, estimated_drinks }
}
