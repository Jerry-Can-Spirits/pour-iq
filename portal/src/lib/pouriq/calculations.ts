// Pure deterministic calculations for menu profitability and complexity.
// No side effects, no DB access, no AI.

import type {
  CocktailWithIngredients,
  CocktailMetrics,
  IngredientOverlap,
  WasteRisk,
  MenuMetrics,
  DrinkVolumeRow,
} from './types'

// UK VAT rate (20%). Sale prices entered inc-VAT must be divided by
// 1.20 before computing margin so GP% matches what an accountant
// would see on the P&L.
const VAT_DIVISOR = 1.20

// price_p is the total price paid for purchase_qty packs of pack_size ml each.
export function costPerMlP(price_p: number, pack_size: number, purchase_qty: number): number {
  return (price_p / purchase_qty) / pack_size
}
export function bottlePourCostP(price_p: number, pack_size: number, purchase_qty: number, pour_ml: number): number {
  return Math.round(costPerMlP(price_p, pack_size, purchase_qty) * pour_ml)
}
export function unitPourCostP(price_p: number, purchase_qty: number, unit_count: number): number {
  return Math.round((price_p / purchase_qty) * unit_count)
}

// Plain-English read-back of how an ingredient is bought, e.g.
// "£14.40 / 24 × 200ml (£0.003/ml)" or "£2.00 / 6 (£0.33 each)".
export function formatPurchaseBasis(e: {
  base_unit: 'ml' | 'g' | 'each'
  pack_size: number
  price_p: number
  purchase_qty: number
}): string {
  const gbp = (p: number) => `£${(p / 100).toFixed(2)}`
  if (e.base_unit === 'each') {
    const each = e.price_p / e.purchase_qty / 100
    const qtyPart = e.purchase_qty === 1 ? '' : ` / ${e.purchase_qty}`
    return `${gbp(e.price_p)}${qtyPart} (£${each.toFixed(2)} each)`
  }
  const unit = e.base_unit // 'ml' or 'g'
  const perBase = costPerBaseUnitP(e.price_p, e.purchase_qty, e.pack_size) / 100
  const buys = e.purchase_qty === 1
    ? `${e.pack_size}${unit}`
    : `${e.purchase_qty} × ${e.pack_size}${unit}`
  return `${gbp(e.price_p)} / ${buys} (£${perBase.toFixed(3)}/${unit})`
}

export function netSalePrice(sale_price_p: number, priceIncludesVat: boolean): number {
  if (!priceIncludesVat) return sale_price_p
  return Math.round(sale_price_p / VAT_DIVISOR)
}

// VAT basis conversion for purchase prices. A price entered inc-VAT is divided
// by VAT_DIVISOR to the net price we store; an ex-VAT price is already net.
// Whole pence. Single source of truth for the library form and invoice import.
export function netPriceP(enteredP: number, includesVat: boolean): number {
  if (!includesVat) return enteredP
  return Math.round(enteredP / VAT_DIVISOR)
}

export function parsePromoDays(csv: string | null | undefined): number[] | null {
  if (!csv) return null
  const parts = csv.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  return parts.length > 0 ? Array.from(new Set(parts)).sort((a, b) => a - b) : null
}

export function isPromoActiveOn(
  date: Date,
  days: number[] | null,
  validFrom: string | null,
  validUntil: string | null,
): boolean {
  const iso = date.toISOString().slice(0, 10)
  if (validFrom && iso < validFrom) return false
  if (validUntil && iso > validUntil) return false
  if (!days || days.length === 0) return true
  return days.includes(date.getUTCDay())
}

// Cost for a single recipe line that references a produce use (e.g. 25ml lemon juice
// at 30p/lemon with a 30ml yield = 25p). Returns 0 when yield is zero or negative.
export function lineCostFromUseP(costPerPurchaseUnitP: number, yieldQty: number, amount: number): number {
  if (yieldQty <= 0) return 0
  return Math.round((costPerPurchaseUnitP / yieldQty) * amount)
}

// True when an ingredient's cost can actually be computed — mirrors the logic
// of ingredientCostPence. False means the cost falls back to £0.
export function ingredientCostComplete(i: import('./types').IngredientWithLibrary): boolean {
  const lib = i.library
  if (lib.price_p <= 0 || lib.pack_size <= 0) return false
  if (i.use) return i.recipe_qty != null
  return lib.base_unit === 'each' ? i.unit_count != null : i.pour_ml != null
}

export function ingredientCostPence(i: import('./types').IngredientWithLibrary): number {
  const lib = i.library
  const perPurchaseUnitP = usableCostPerBaseUnitP(lib.price_p, lib.purchase_qty, lib.pack_size, lib.yield_pct)
  if (i.use) return lineCostFromUseP(perPurchaseUnitP, i.use.yield_qty, i.recipe_qty ?? 0)
  const amount = lib.base_unit === 'each' ? (i.unit_count ?? 0) : (i.pour_ml ?? 0)
  return Math.round(perPurchaseUnitP * amount)
}

export function calculateCocktailMetrics(
  cocktail: CocktailWithIngredients,
  priceIncludesVat: boolean,
): CocktailMetrics {
  const pour_cost_p = cocktail.ingredients.reduce((sum, ing) => sum + ingredientCostPence(ing), 0)
  const net_sale_p = netSalePrice(cocktail.sale_price_p, priceIncludesVat)
  const margin_p = net_sale_p - pour_cost_p
  const gp_pct = net_sale_p === 0 ? 0 : (margin_p / net_sale_p) * 100

  // A drink's cost is trustworthy only when every ingredient can be priced
  // (and it has at least one). Otherwise the £0 fallback understates cost
  // and inflates GP, so downstream the drink is flagged and excluded.
  const cost_complete = cocktail.ingredients.length > 0
    && cocktail.ingredients.every(ingredientCostComplete)

  const metrics: CocktailMetrics = {
    cocktail_id: cocktail.id,
    name: cocktail.name,
    sale_price_p: cocktail.sale_price_p,
    net_sale_p,
    pour_cost_p,
    margin_p,
    gp_pct: Math.round(gp_pct * 10) / 10,
    cost_complete,
  }

  if (cocktail.promotional_price_p !== null && cocktail.promotional_price_p !== undefined) {
    const promo_net_p = netSalePrice(cocktail.promotional_price_p, priceIncludesVat)
    const promo_margin_p = promo_net_p - pour_cost_p
    const promo_gp_pct = promo_net_p === 0 ? 0 : (promo_margin_p / promo_net_p) * 100
    const days = parsePromoDays(cocktail.promotional_days)
    const validFrom = cocktail.promotional_valid_from ?? null
    const validUntil = cocktail.promotional_valid_until ?? null
    metrics.promo = {
      sale_price_p: cocktail.promotional_price_p,
      margin_p: promo_margin_p,
      gp_pct: Math.round(promo_gp_pct * 10) / 10,
      label: cocktail.promotional_label ?? null,
      days,
      valid_from: validFrom,
      valid_until: validUntil,
      active_today: isPromoActiveOn(new Date(), days, validFrom, validUntil),
    }
  }

  return metrics
}

function normaliseIngredientName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function calculateIngredientOverlap(
  cocktails: CocktailWithIngredients[],
): IngredientOverlap[] {
  const map = new Map<string, { display: string; cocktailIds: Set<string> }>()
  for (const c of cocktails) {
    for (const ing of c.ingredients) {
      const key = normaliseIngredientName(ing.library.name)
      if (!map.has(key)) map.set(key, { display: ing.library.name.trim(), cocktailIds: new Set() })
      map.get(key)!.cocktailIds.add(c.id)
    }
  }
  return Array.from(map.entries())
    .map(([, v]) => ({
      ingredient_name: v.display,
      cocktail_count: v.cocktailIds.size,
      cocktail_ids: Array.from(v.cocktailIds),
    }))
    .sort((a, b) => b.cocktail_count - a.cocktail_count)
}

export function calculateWasteRisks(
  cocktails: CocktailWithIngredients[],
  overlap: IngredientOverlap[],
): WasteRisk[] {
  const cocktailById = new Map(cocktails.map((c) => [c.id, c]))
  const single = overlap.filter((o) => o.cocktail_count === 1)
  return single.map((o) => {
    const cocktailId = o.cocktail_ids[0]
    const cocktail = cocktailById.get(cocktailId)
    return {
      ingredient_name: o.ingredient_name,
      cocktail_id: cocktailId,
      cocktail_name: cocktail?.name ?? 'Unknown',
      reason: `Used only in "${cocktail?.name ?? 'one cocktail'}" — risk of slow stock rotation.`,
    }
  })
}

// Unified cost per base unit (ml | g | each). price_p is the price for `packs`
// packs; each pack holds `pack_size` base units. Single source for the new
// ingredient model. Defends against zero packs/size.
export function costPerBaseUnitP(price_p: number, packs: number, pack_size: number): number {
  const p = packs > 0 ? packs : 1
  const s = pack_size > 0 ? pack_size : 1
  return (price_p / p) / s
}
// Usable cost per base unit, accounting for yield/waste (yield_pct 100 = no loss).
export function usableCostPerBaseUnitP(price_p: number, packs: number, pack_size: number, yield_pct: number): number {
  const y = yield_pct > 0 ? yield_pct : 100
  return costPerBaseUnitP(price_p, packs, pack_size) / (y / 100)
}

// GP% for a single priced serve. Returns null when no price is set (no GP to show).
// cost = costPerMlNetP * pourMl; if pricesIncludeVat the sale price is netted first.
export function serveGp(args: { costPerMlNetP: number; pourMl: number; salePriceP: number; pricesIncludeVat: boolean }): number | null {
  if (args.salePriceP <= 0) return null
  const saleNet = args.pricesIncludeVat ? netPriceP(args.salePriceP, true) : args.salePriceP
  if (saleNet <= 0) return null
  const cost = args.costPerMlNetP * args.pourMl
  return ((saleNet - cost) / saleNet) * 100
}

export function calculateMenuMetrics(
  cocktails: CocktailWithIngredients[],
  priceIncludesVat: boolean,
  volumes: DrinkVolumeRow[] = [],
): MenuMetrics {
  const volumeByCocktail = new Map<string, DrinkVolumeRow>()
  for (const v of volumes) volumeByCocktail.set(v.cocktail_id, v)

  const cocktail_metrics = cocktails.map((c) => {
    const m = calculateCocktailMetrics(c, priceIncludesVat)
    const v = volumeByCocktail.get(c.id)
    if (v) {
      m.volume = {
        units_sold: v.units_sold,
        period_start: v.period_start,
        period_end: v.period_end,
        contribution_p: m.margin_p * v.units_sold,
      }
    }
    return m
  })
  const ingredient_overlap = calculateIngredientOverlap(cocktails)
  const waste_risks = calculateWasteRisks(cocktails, ingredient_overlap)

  // Only drinks with trustworthy costs feed the headline numbers. Drinks
  // with incomplete cost data have understated cost / inflated GP, so they
  // are excluded from the average, blended GP, and best/worst margin.
  const costed = cocktail_metrics.filter((m) => m.cost_complete && m.sale_price_p > 0)
  const incomplete_cost_count = cocktail_metrics.filter((m) => !m.cost_complete).length

  const avg_gp_pct = costed.length === 0
    ? 0
    : Math.round((costed.reduce((s, m) => s + m.gp_pct, 0) / costed.length) * 10) / 10

  // Blended GP: total contribution margin ÷ total net sales across costed
  // drinks that actually sold. The P&L-true headline once volumes exist.
  let totalMargin = 0
  let totalNet = 0
  for (const m of costed) {
    if (!m.volume) continue
    totalMargin += m.margin_p * m.volume.units_sold
    totalNet += m.net_sale_p * m.volume.units_sold
  }
  const blended_gp_pct = totalNet > 0 ? Math.round((totalMargin / totalNet) * 1000) / 10 : null
  const headline_gp_pct = blended_gp_pct ?? avg_gp_pct
  const headline_basis: 'blended' | 'average' = blended_gp_pct !== null ? 'blended' : 'average'

  const sorted = [...costed].sort((a, b) => b.margin_p - a.margin_p)
  const best_margin = sorted[0] ?? null
  const worst_margin = sorted[sorted.length - 1] ?? null

  return {
    avg_gp_pct,
    blended_gp_pct,
    headline_gp_pct,
    headline_basis,
    incomplete_cost_count,
    best_margin,
    worst_margin,
    waste_risk_count: waste_risks.length,
    cocktail_metrics,
    ingredient_overlap,
    waste_risks,
  }
}
