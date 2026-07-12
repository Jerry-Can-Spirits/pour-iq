import { applyYield } from './variance'

// Bottles received from one invoice line. extracted_quantity is the number of
// PURCHASE units on the line; one purchase unit holds purchase_qty bottles.
export function receiptBottlesFromInvoiceLine(extractedQuantity: number | null, purchaseQty: number): number | null {
  if (extractedQuantity === null) return null
  return extractedQuantity * (purchaseQty > 0 ? purchaseQty : 1)
}

// Whole bottles to order to reach par. 0 when at/above par, on-hand unknown,
// or no par set. Uses raw on-hand (a negative on-hand orders more).
export function reorderQty(onHandBottles: number | null, parBottles: number | null): number {
  if (onHandBottles === null || parBottles === null) return 0
  return Math.max(0, Math.ceil(parBottles - onHandBottles))
}

// The noun the stock page uses for a counted pack, driven by the ingredient's
// free-text pack_format (e.g. keg, can, box, bag-in-box). Defaults to bottle
// when unset, so a 10L cola box can read "boxes" instead of "bottles" once its
// format is filled in. Known formats get a correct plural; unknown free text is
// shown verbatim with a naive plural.
const KNOWN_PACK_WORDS: Record<string, { one: string; many: string }> = {
  bottle: { one: 'bottle', many: 'bottles' },
  can: { one: 'can', many: 'cans' },
  keg: { one: 'keg', many: 'kegs' },
  cask: { one: 'cask', many: 'casks' },
  box: { one: 'box', many: 'boxes' },
  case: { one: 'case', many: 'cases' },
  carton: { one: 'carton', many: 'cartons' },
  pouch: { one: 'pouch', many: 'pouches' },
  bag: { one: 'bag', many: 'bags' },
  'bag-in-box': { one: 'bag-in-box', many: 'bags-in-box' },
}

export function stockUnitWords(packFormat: string | null): { one: string; many: string } {
  const raw = packFormat?.trim()
  if (!raw) return { one: 'bottle', many: 'bottles' }
  const known = KNOWN_PACK_WORDS[raw.toLowerCase()]
  if (known) return known
  return { one: raw, many: /(s|x|z|ch|sh)$/i.test(raw) ? `${raw}es` : `${raw}s` }
}

// Anchored perpetual on-hand, in bottles/containers.
export function computeOnHandBottles(input: {
  anchorCountQty: number
  receiptsSinceBottles: number
  usageSinceMl: number
  bottleSizeMl: number
  yieldPct: number
}): number {
  const expectedUsageBottles = applyYield(input.usageSinceMl, input.yieldPct) / input.bottleSizeMl
  return input.anchorCountQty + input.receiptsSinceBottles - expectedUsageBottles
}
