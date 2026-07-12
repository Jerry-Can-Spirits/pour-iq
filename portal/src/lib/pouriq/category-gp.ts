import type { ItemType } from './types'
import { itemTypeToSectionName } from './menu-sections-plan'

export interface CategoryGpInput {
  item_type: ItemType
  gp_pct: number
  margin_p: number
  net_sale_p: number
  units_sold: number
  cost_complete: boolean
  sale_price_p: number
}
export interface CategoryGpRow {
  label: string
  drink_count: number
  gp_pct: number
  basis: 'blended' | 'average'
  under_target: boolean
}

const CATEGORY_ORDER = ['Cocktails', 'Beer & Cider', 'Wine', 'Spirits', 'Soft Drinks', 'Food', 'Other']
const round1 = (n: number): number => Math.round(n * 10) / 10

export function categoryGp(rows: CategoryGpInput[], targetGpPct: number): CategoryGpRow[] {
  const groups = new Map<string, CategoryGpInput[]>()
  for (const r of rows) {
    if (!r.cost_complete || r.sale_price_p <= 0) continue
    const label = itemTypeToSectionName(r.item_type)
    const list = groups.get(label) ?? []
    list.push(r)
    groups.set(label, list)
  }
  const out: CategoryGpRow[] = []
  for (const [label, group] of groups) {
    let totalMargin = 0
    let totalNet = 0
    for (const r of group) {
      if (r.units_sold > 0) {
        totalMargin += r.margin_p * r.units_sold
        totalNet += r.net_sale_p * r.units_sold
      }
    }
    const blended = totalNet > 0 ? round1((totalMargin / totalNet) * 100) : null
    const average = round1(group.reduce((s, r) => s + r.gp_pct, 0) / group.length)
    const gp_pct = blended ?? average
    out.push({ label, drink_count: group.length, gp_pct, basis: blended !== null ? 'blended' : 'average', under_target: gp_pct < targetGpPct })
  }
  const rank = (l: string) => { const i = CATEGORY_ORDER.indexOf(l); return i === -1 ? CATEGORY_ORDER.length : i }
  return out.sort((a, b) => rank(a.label) - rank(b.label))
}
