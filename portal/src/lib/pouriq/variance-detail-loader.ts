// Per-ingredient variance detail: the transparent ledger components + the
// per-drink expected-usage breakdown + trend, for the drill-in page. Mirrors
// the window math of variance-rolling-loader (so the figures reconcile) but for
// a single ingredient and with the components exposed. Not server-only, matching
// the sibling loaders so the pure pieces stay importable.

import {
  pairLatestCounts, sumBucketsInWindow, sumAmountsInWindow, countInWindow,
  applyYield, calcVariance, calcVarianceCostP, classifyVariance, buildVarianceLedger,
  produceLineUnits,
  type VarianceSeverity, type CountEvent, type VarianceLedger,
} from './variance'
import { readProductionYields, readProductionConsumption } from './prepared'
import { usableCostPerBaseUnitP } from './calculations'

export interface VarianceDetailDrink {
  name: string
  units: number
  pour_ml: number       // ml-path: pour size in ml; produce-path: recipe_qty per serve
  usage_ml: number      // ml-path: total ml used; produce-path: total purchase units
  use_name?: string     // produce only: use name, e.g. "Juice"
  recipe_unit?: string  // produce only: recipe unit, e.g. "ml"
}
export interface VarianceDetailTrendPoint { counted_at: string; variance_cost_p: number | null; reason: string | null }
export interface VarianceDetail {
  ingredient_id: string
  name: string
  pack_size: number
  price_p: number
  purchase_qty: number
  base_unit: 'ml' | 'each' | 'g'
  window: { opening_at: string; opening_qty: number; closing_at: string; closing_qty: number } | null
  ledger: VarianceLedger | null
  variance_ml: number | null
  variance_pct: number | null
  variance_cost_p: number | null
  severity: VarianceSeverity
  deliveries_count: number
  batches_count: number
  per_drink: VarianceDetailDrink[]
  trend: VarianceDetailTrendPoint[]
  latest_reason: string | null
}

interface MetaRow { name: string; pack_size: number; price_p: number; purchase_qty: number; yield_pct: number }
interface LineRow { cocktail_id: string; cocktail_name: string; pour_ml: number }
interface VolumeRow { cocktail_id: string; period_start: string; period_end: string; units_sold: number }
interface EventRow { counted_at: string; count_qty: number; reason: string | null }
interface ReceiptRow { received_at: string; qty: number }

// Produce-only interfaces
interface ProduceLineRow {
  cocktail_id: string
  cocktail_name: string
  recipe_qty: number
  yield_qty: number
  use_name: string
  recipe_unit: string
}

const TREND_LIMIT = 6

// Produce branch: ledger + per-drink breakdown + trend in purchase units.
// Mirrors the rolling-loader produce pass so the figures reconcile.
async function loadProduceVarianceDetail(
  db: D1Database,
  tradeAccountId: string,
  ingredientId: string,
  base_unit: 'each' | 'g',
): Promise<VarianceDetail | null> {
  const meta = await db
    .prepare(`SELECT name, pack_size, price_p, purchase_qty, yield_pct FROM pouriq_ingredients_library WHERE id = ?1 AND trade_account_id = ?2 AND price_p > 0`)
    .bind(ingredientId, tradeAccountId)
    .first<MetaRow>()
  if (!meta) return null

  const [lineRes, volRes, evRes, rcptRes, prodYields, prodConsumption] = await Promise.all([
    db.prepare(`
      SELECT c.id AS cocktail_id, c.name AS cocktail_name,
             i.recipe_qty AS recipe_qty, u.yield_qty AS yield_qty,
             u.name AS use_name, u.recipe_unit AS recipe_unit
      FROM pouriq_cocktails c
      JOIN pouriq_menus m ON m.id = c.menu_id
      JOIN pouriq_ingredients i ON i.cocktail_id = c.id
      JOIN pouriq_ingredient_uses u ON u.id = i.use_id
      WHERE m.trade_account_id = ?1 AND i.library_ingredient_id = ?2
        AND i.use_id IS NOT NULL
    `).bind(tradeAccountId, ingredientId).all<ProduceLineRow>(),
    db.prepare(`
      SELECT v.cocktail_id AS cocktail_id, v.period_start AS period_start, v.period_end AS period_end, v.units_sold AS units_sold
      FROM pouriq_drink_volumes v
      JOIN pouriq_cocktails c ON c.id = v.cocktail_id
      JOIN pouriq_menus m ON m.id = c.menu_id
      WHERE m.trade_account_id = ?1
    `).bind(tradeAccountId).all<VolumeRow>(),
    db.prepare(`SELECT counted_at, count_qty, reason FROM pouriq_stock_count_events WHERE trade_account_id = ?1 AND library_ingredient_id = ?2 ORDER BY counted_at ASC`).bind(tradeAccountId, ingredientId).all<EventRow>(),
    db.prepare(`SELECT received_at, qty FROM pouriq_stock_receipts WHERE trade_account_id = ?1 AND library_ingredient_id = ?2`).bind(tradeAccountId, ingredientId).all<ReceiptRow>(),
    readProductionYields(db, tradeAccountId),
    readProductionConsumption(db, tradeAccountId),
  ])

  const lines = lineRes.results ?? []
  const events = evRes.results ?? []
  const receiptRows = (rcptRes.results ?? []).map((r) => ({ amount: r.qty, at: r.received_at }))
  const yieldRows = prodYields.filter((y) => y.prepared_ingredient_id === ingredientId).map((y) => ({ amount: y.yield_base_produced, at: y.produced_at }))
  const consumeRows = prodConsumption.filter((c) => c.component_ingredient_id === ingredientId).map((c) => ({ amount: c.amount_base_consumed, at: c.produced_at }))

  const volumesByCocktail = new Map<string, VolumeRow[]>()
  for (const v of volRes.results ?? []) {
    const arr = volumesByCocktail.get(v.cocktail_id) ?? []
    arr.push(v); volumesByCocktail.set(v.cocktail_id, arr)
  }

  const usableCostP = usableCostPerBaseUnitP(meta.price_p, meta.purchase_qty, meta.pack_size, meta.yield_pct)

  const base = {
    ingredient_id: ingredientId,
    name: meta.name,
    pack_size: meta.pack_size,
    price_p: meta.price_p,
    purchase_qty: meta.purchase_qty,
    base_unit,
    latest_reason: events.length ? events[events.length - 1].reason : null,
  }

  const pair = pairLatestCounts(events.map((e): CountEvent => ({ counted_at: e.counted_at, count_qty: e.count_qty, reason: e.reason })))
  if (!pair) {
    return { ...base, window: null, ledger: null, variance_ml: null, variance_pct: null, variance_cost_p: null, severity: 'none', deliveries_count: 0, batches_count: 0, per_drink: [], trend: [] }
  }

  const ws = pair.previous.counted_at
  const we = pair.latest.counted_at
  const pack = meta.pack_size

  // All quantities in individual purchase units (pack_size converts packs to units,
  // mirroring the rolling-loader produce pass).
  const deliveriesUnits = sumAmountsInWindow(receiptRows, ws, we) * pack
  const producedUnits = sumAmountsInWindow(yieldRows, ws, we)
  const consumedUnits = sumAmountsInWindow(consumeRows, ws, we)

  const per_drink: VarianceDetailDrink[] = []
  let theoreticalUnits = 0
  for (const line of lines) {
    const units = sumBucketsInWindow(volumesByCocktail.get(line.cocktail_id) ?? [], ws.slice(0, 10), we.slice(0, 10))
    if (units <= 0) continue
    const drinkUnits = units * produceLineUnits(1, line.recipe_qty, line.yield_qty)
    theoreticalUnits += drinkUnits
    per_drink.push({
      name: line.cocktail_name,
      units,
      pour_ml: line.recipe_qty,
      usage_ml: drinkUnits,
      use_name: line.use_name,
      recipe_unit: line.recipe_unit,
    })
  }
  per_drink.sort((a, b) => b.usage_ml - a.usage_ml)

  const openingUnits = pair.previous.count_qty * pack
  const closingUnits = pair.latest.count_qty * pack

  const ledger = buildVarianceLedger({
    openingQty: openingUnits,
    closingQty: closingUnits,
    deliveriesBottles: deliveriesUnits,
    producedBottles: producedUnits,
    consumedBottles: consumedUnits,
    expectedUsageBottles: theoreticalUnits,
  })

  const actualUsedUnits = openingUnits - closingUnits + deliveriesUnits + producedUnits - consumedUnits
  const { variance_ml: variance_units, variance_pct } = calcVariance(actualUsedUnits, theoreticalUnits)
  const severity = classifyVariance(variance_units, variance_pct, pack)
  const variance_cost_p = variance_units !== null ? Math.round(variance_units * usableCostP) : null

  // Trend: variance per consecutive count pair in purchase units.
  const trend: VarianceDetailTrendPoint[] = []
  for (let k = 1; k < events.length; k++) {
    const prev = events[k - 1]
    const cur = events[k]
    const wsT = prev.counted_at
    const weT = cur.counted_at
    let rawT = 0
    for (const line of lines) {
      const units = sumBucketsInWindow(volumesByCocktail.get(line.cocktail_id) ?? [], wsT.slice(0, 10), weT.slice(0, 10))
      rawT += units * produceLineUnits(1, line.recipe_qty, line.yield_qty)
    }
    const prevUnits = prev.count_qty * pack
    const curUnits = cur.count_qty * pack
    const actT = prevUnits - curUnits
      + sumAmountsInWindow(receiptRows, wsT, weT) * pack
      + sumAmountsInWindow(yieldRows, wsT, weT)
      - sumAmountsInWindow(consumeRows, wsT, weT)
    const v = calcVariance(actT, rawT)
    trend.push({
      counted_at: cur.counted_at,
      variance_cost_p: v.variance_ml !== null ? Math.round(v.variance_ml * usableCostP) : null,
      reason: cur.reason,
    })
  }

  return {
    ...base,
    window: { opening_at: ws, opening_qty: pair.previous.count_qty, closing_at: we, closing_qty: pair.latest.count_qty },
    ledger,
    variance_ml: variance_units,
    variance_pct,
    variance_cost_p,
    severity,
    deliveries_count: countInWindow(receiptRows, ws, we),
    batches_count: countInWindow(yieldRows, ws, we) + countInWindow(consumeRows, ws, we),
    per_drink,
    trend: trend.slice(-TREND_LIMIT),
  }
}

export async function loadVarianceDetail(
  db: D1Database,
  tradeAccountId: string,
  ingredientId: string,
): Promise<VarianceDetail | null> {
  // Route based on the ingredient's base_unit. The produce branch handles
  // each/g; the ml branch below is unchanged for ml ingredients.
  const unitRow = await db
    .prepare(`SELECT base_unit FROM pouriq_ingredients_library WHERE id = ?1 AND trade_account_id = ?2 AND price_p > 0`)
    .bind(ingredientId, tradeAccountId)
    .first<{ base_unit: string }>()
  if (!unitRow) return null

  if (unitRow.base_unit === 'each' || unitRow.base_unit === 'g') {
    return loadProduceVarianceDetail(db, tradeAccountId, ingredientId, unitRow.base_unit as 'each' | 'g')
  }

  // --- ml branch (unchanged) ---
  const meta = await db
    .prepare(`SELECT name, pack_size, price_p, purchase_qty, yield_pct FROM pouriq_ingredients_library WHERE id = ?1 AND trade_account_id = ?2 AND base_unit = 'ml' AND price_p > 0`)
    .bind(ingredientId, tradeAccountId)
    .first<MetaRow>()
  if (!meta) return null

  const [lineRes, volRes, evRes, rcptRes, prodYields, prodConsumption] = await Promise.all([
    db.prepare(`
      SELECT c.id AS cocktail_id, c.name AS cocktail_name, i.pour_ml AS pour_ml
      FROM pouriq_cocktails c
      JOIN pouriq_menus m ON m.id = c.menu_id
      JOIN pouriq_ingredients i ON i.cocktail_id = c.id
      WHERE m.trade_account_id = ?1 AND i.library_ingredient_id = ?2 AND i.pour_ml IS NOT NULL
    `).bind(tradeAccountId, ingredientId).all<LineRow>(),
    db.prepare(`
      SELECT v.cocktail_id AS cocktail_id, v.period_start AS period_start, v.period_end AS period_end, v.units_sold AS units_sold
      FROM pouriq_drink_volumes v
      JOIN pouriq_cocktails c ON c.id = v.cocktail_id
      JOIN pouriq_menus m ON m.id = c.menu_id
      WHERE m.trade_account_id = ?1
    `).bind(tradeAccountId).all<VolumeRow>(),
    db.prepare(`SELECT counted_at, count_qty, reason FROM pouriq_stock_count_events WHERE trade_account_id = ?1 AND library_ingredient_id = ?2 ORDER BY counted_at ASC`).bind(tradeAccountId, ingredientId).all<EventRow>(),
    db.prepare(`SELECT received_at, qty FROM pouriq_stock_receipts WHERE trade_account_id = ?1 AND library_ingredient_id = ?2`).bind(tradeAccountId, ingredientId).all<ReceiptRow>(),
    readProductionYields(db, tradeAccountId),
    readProductionConsumption(db, tradeAccountId),
  ])

  const lines = lineRes.results ?? []
  const events = evRes.results ?? []
  const receiptRows = (rcptRes.results ?? []).map((r) => ({ amount: r.qty, at: r.received_at }))
  const yieldRows = prodYields.filter((y) => y.prepared_ingredient_id === ingredientId).map((y) => ({ amount: y.yield_base_produced, at: y.produced_at }))
  const consumeRows = prodConsumption.filter((c) => c.component_ingredient_id === ingredientId).map((c) => ({ amount: c.amount_base_consumed, at: c.produced_at }))

  const volumesByCocktail = new Map<string, VolumeRow[]>()
  for (const v of volRes.results ?? []) {
    const arr = volumesByCocktail.get(v.cocktail_id) ?? []
    arr.push(v); volumesByCocktail.set(v.cocktail_id, arr)
  }

  const base = {
    ingredient_id: ingredientId,
    name: meta.name,
    pack_size: meta.pack_size,
    price_p: meta.price_p,
    purchase_qty: meta.purchase_qty,
    base_unit: 'ml' as const,
    latest_reason: events.length ? events[events.length - 1].reason : null,
  }

  const pair = pairLatestCounts(events.map((e): CountEvent => ({ counted_at: e.counted_at, count_qty: e.count_qty, reason: e.reason })))
  if (!pair) {
    return { ...base, window: null, ledger: null, variance_ml: null, variance_pct: null, variance_cost_p: null, severity: 'none', deliveries_count: 0, batches_count: 0, per_drink: [], trend: [] }
  }

  const ws = pair.previous.counted_at
  const we = pair.latest.counted_at
  const pack = meta.pack_size

  const deliveriesBottles = sumAmountsInWindow(receiptRows, ws, we)
  const producedBottles = sumAmountsInWindow(yieldRows, ws, we) / pack
  const consumedBottles = sumAmountsInWindow(consumeRows, ws, we) / pack

  const per_drink: VarianceDetailDrink[] = []
  let rawUsageMl = 0
  for (const line of lines) {
    const units = sumBucketsInWindow(volumesByCocktail.get(line.cocktail_id) ?? [], ws.slice(0, 10), we.slice(0, 10))
    if (units <= 0) continue
    const usage_ml = units * line.pour_ml
    rawUsageMl += usage_ml
    per_drink.push({ name: line.cocktail_name, units, pour_ml: line.pour_ml, usage_ml })
  }
  per_drink.sort((a, b) => b.usage_ml - a.usage_ml)

  const expectedUsageBottles = applyYield(rawUsageMl, meta.yield_pct) / pack
  const ledger = buildVarianceLedger({
    openingQty: pair.previous.count_qty,
    closingQty: pair.latest.count_qty,
    deliveriesBottles, producedBottles, consumedBottles, expectedUsageBottles,
  })
  const variance_ml = ledger.variance_bottles * pack
  const actualUsedMl = (pair.previous.count_qty - pair.latest.count_qty) * pack + deliveriesBottles * pack + producedBottles * pack - consumedBottles * pack
  const { variance_pct } = calcVariance(actualUsedMl, applyYield(rawUsageMl, meta.yield_pct))
  const severity = classifyVariance(variance_ml, variance_pct, pack)
  const variance_cost_p = calcVarianceCostP(variance_ml, pack, meta.price_p, meta.purchase_qty)

  // Trend: variance per consecutive count pair, folding the same window terms.
  const trend: VarianceDetailTrendPoint[] = []
  for (let k = 1; k < events.length; k++) {
    const prev = events[k - 1]
    const cur = events[k]
    const wsT = prev.counted_at
    const weT = cur.counted_at
    let rawT = 0
    for (const line of lines) {
      const units = sumBucketsInWindow(volumesByCocktail.get(line.cocktail_id) ?? [], wsT.slice(0, 10), weT.slice(0, 10))
      rawT += units * line.pour_ml
    }
    const actT = (prev.count_qty - cur.count_qty) * pack
      + sumAmountsInWindow(receiptRows, wsT, weT) * pack
      + sumAmountsInWindow(yieldRows, wsT, weT)
      - sumAmountsInWindow(consumeRows, wsT, weT)
    const v = calcVariance(actT, applyYield(rawT, meta.yield_pct))
    trend.push({ counted_at: cur.counted_at, variance_cost_p: calcVarianceCostP(v.variance_ml, pack, meta.price_p, meta.purchase_qty), reason: cur.reason })
  }

  return {
    ...base,
    window: { opening_at: ws, opening_qty: pair.previous.count_qty, closing_at: we, closing_qty: pair.latest.count_qty },
    ledger,
    variance_ml,
    variance_pct,
    variance_cost_p,
    severity,
    deliveries_count: countInWindow(receiptRows, ws, we),
    batches_count: countInWindow(yieldRows, ws, we) + countInWindow(consumeRows, ws, we),
    per_drink,
    trend: trend.slice(-TREND_LIMIT),
  }
}
