import 'server-only'
import { costPerMlP, usableCostPerBaseUnitP } from './calculations'
import {
  pairLatestCounts, sumBucketsInWindow, persistentLossFlag,
  calcVariance, calcVarianceCostP, classifyVariance, applyYield, sumAmountsInWindow, countInWindow,
  produceLineUnits,
  type VarianceSeverity, type CountEvent,
} from './variance'
import { readProductionYields, readProductionConsumption } from './prepared'

export interface RollingTrendPoint {
  counted_at: string
  variance_cost_p: number | null
  reason: string | null
}

export interface RollingVarianceRow {
  library_ingredient_id: string
  library_name: string
  pack_size: number
  price_p: number
  purchase_qty: number
  base_unit: 'ml' | 'each' | 'g'
  latest_count_at: string | null
  latest_count_qty: number | null
  previous_count_at: string | null
  theoretical_used_ml: number
  actual_used_ml: number | null
  variance_ml: number | null
  variance_pct: number | null
  variance_cost_p: number | null
  severity: VarianceSeverity
  impact_p: number
  unmatched_in_window: number
  deliveries_in_window: number
  batches_in_window: number
  latest_reason: string | null
  persistent_loss: boolean
  trend: RollingTrendPoint[]
}

interface RecipeLineRow {
  cocktail_id: string
  library_ingredient_id: string
  pour_ml: number
  name: string
  pack_size: number
  price_p: number
  purchase_qty: number
  yield_pct: number
}
interface VolumeRow { cocktail_id: string; period_start: string; period_end: string; units_sold: number }
interface EventRow { library_ingredient_id: string; counted_at: string; count_qty: number; reason: string | null }
interface ReceiptRow { library_ingredient_id: string; received_at: string; qty: number }

async function readTenantRecipes(db: D1Database, tradeAccountId: string): Promise<RecipeLineRow[]> {
  const res = await db.prepare(`
    SELECT c.id AS cocktail_id, i.library_ingredient_id AS library_ingredient_id, i.pour_ml AS pour_ml,
           lib.name AS name, lib.pack_size AS pack_size, lib.price_p AS price_p,
           lib.purchase_qty AS purchase_qty, lib.yield_pct AS yield_pct
    FROM pouriq_cocktails c
    JOIN pouriq_menus m ON m.id = c.menu_id
    JOIN pouriq_ingredients i ON i.cocktail_id = c.id
    JOIN pouriq_ingredients_library lib ON lib.id = i.library_ingredient_id
    WHERE m.trade_account_id = ?1
      AND lib.base_unit = 'ml' AND lib.price_p > 0 AND i.pour_ml IS NOT NULL
  `).bind(tradeAccountId).all<RecipeLineRow>()
  return res.results ?? []
}

interface ProduceRecipeLineRow {
  cocktail_id: string
  library_ingredient_id: string
  recipe_qty: number
  yield_qty: number
  base_unit: string
  name: string
  pack_size: number
  price_p: number
  purchase_qty: number
  yield_pct: number
}

async function readTenantProduceRecipes(db: D1Database, tradeAccountId: string): Promise<ProduceRecipeLineRow[]> {
  const res = await db.prepare(`
    SELECT c.id AS cocktail_id, i.library_ingredient_id AS library_ingredient_id,
           i.recipe_qty AS recipe_qty, u.yield_qty AS yield_qty,
           lib.base_unit AS base_unit, lib.name AS name, lib.pack_size AS pack_size,
           lib.price_p AS price_p, lib.purchase_qty AS purchase_qty, lib.yield_pct AS yield_pct
    FROM pouriq_cocktails c
    JOIN pouriq_menus m ON m.id = c.menu_id
    JOIN pouriq_ingredients i ON i.cocktail_id = c.id
    JOIN pouriq_ingredients_library lib ON lib.id = i.library_ingredient_id
    JOIN pouriq_ingredient_uses u ON u.id = i.use_id
    WHERE m.trade_account_id = ?1
      AND lib.base_unit IN ('each', 'g') AND lib.price_p > 0 AND i.use_id IS NOT NULL
  `).bind(tradeAccountId).all<ProduceRecipeLineRow>()
  return res.results ?? []
}

async function readTenantVolumes(db: D1Database, tradeAccountId: string): Promise<VolumeRow[]> {
  const res = await db.prepare(`
    SELECT v.cocktail_id AS cocktail_id, v.period_start AS period_start, v.period_end AS period_end, v.units_sold AS units_sold
    FROM pouriq_drink_volumes v
    JOIN pouriq_cocktails c ON c.id = v.cocktail_id
    JOIN pouriq_menus m ON m.id = c.menu_id
    WHERE m.trade_account_id = ?1
  `).bind(tradeAccountId).all<VolumeRow>()
  return res.results ?? []
}

async function readTenantEvents(db: D1Database, tradeAccountId: string): Promise<EventRow[]> {
  const res = await db.prepare(`
    SELECT library_ingredient_id, counted_at, count_qty, reason
    FROM pouriq_stock_count_events
    WHERE trade_account_id = ?1
    ORDER BY counted_at ASC
  `).bind(tradeAccountId).all<EventRow>()
  return res.results ?? []
}

async function readTenantReceipts(db: D1Database, tradeAccountId: string): Promise<ReceiptRow[]> {
  const res = await db.prepare(
    `SELECT library_ingredient_id, received_at, qty FROM pouriq_stock_receipts WHERE trade_account_id = ?1`
  ).bind(tradeAccountId).all<ReceiptRow>()
  return res.results ?? []
}

async function readUnmatchedInWindow(db: D1Database, tradeAccountId: string, windowStart: string, windowEnd: string): Promise<number> {
  // counted_at is stored via datetime('now') as "YYYY-MM-DD HH:MM:SS" (space),
  // while POS sold_at is ISO 8601 with a "T". Normalise the window bounds to the
  // "T" form so the lexical comparison against sold_at is correct on the
  // count-start and count-end dates.
  const row = await db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) AS q
    FROM pouriq_pos_unmatched_lines
    WHERE trade_account_id = ?1 AND sold_at > replace(?2, ' ', 'T') AND sold_at <= replace(?3, ' ', 'T')
  `).bind(tradeAccountId, windowStart, windowEnd).first<{ q: number }>()
  return row?.q ?? 0
}

const TREND_LIMIT = 6

export async function loadRollingVariance(db: D1Database, tradeAccountId: string): Promise<RollingVarianceRow[]> {
  const [recipes, produceRecipes, volumes, events, receipts, productionYields, productionConsumption] = await Promise.all([
    readTenantRecipes(db, tradeAccountId),
    readTenantProduceRecipes(db, tradeAccountId),
    readTenantVolumes(db, tradeAccountId),
    readTenantEvents(db, tradeAccountId),
    readTenantReceipts(db, tradeAccountId),
    readProductionYields(db, tradeAccountId),
    readProductionConsumption(db, tradeAccountId),
  ])

  const volumesByCocktail = new Map<string, VolumeRow[]>()
  for (const v of volumes) {
    const arr = volumesByCocktail.get(v.cocktail_id) ?? []
    arr.push(v); volumesByCocktail.set(v.cocktail_id, arr)
  }

  interface Meta { name: string; pack_size: number; price_p: number; purchase_qty: number; yield_pct: number }
  const metaByIngredient = new Map<string, Meta>()
  const linesByIngredient = new Map<string, Array<{ cocktail_id: string; pour_ml: number }>>()
  for (const r of recipes) {
    if (!metaByIngredient.has(r.library_ingredient_id)) {
      metaByIngredient.set(r.library_ingredient_id, {
        name: r.name, pack_size: r.pack_size, price_p: r.price_p, purchase_qty: r.purchase_qty, yield_pct: r.yield_pct,
      })
    }
    const arr = linesByIngredient.get(r.library_ingredient_id) ?? []
    arr.push({ cocktail_id: r.cocktail_id, pour_ml: r.pour_ml })
    linesByIngredient.set(r.library_ingredient_id, arr)
  }

  const eventsByIngredient = new Map<string, EventRow[]>()
  for (const e of events) {
    const arr = eventsByIngredient.get(e.library_ingredient_id) ?? []
    arr.push(e); eventsByIngredient.set(e.library_ingredient_id, arr)
  }

  // Stock movements folded into actual usage so deliveries/production are not
  // mistaken for pour variance. Same sources as stock-loader.ts.
  const receiptsByIngredient = new Map<string, Array<{ amount: number; at: string }>>()
  for (const r of receipts) {
    const arr = receiptsByIngredient.get(r.library_ingredient_id) ?? []
    arr.push({ amount: r.qty, at: r.received_at }); receiptsByIngredient.set(r.library_ingredient_id, arr)
  }
  const yieldByPrepared = new Map<string, Array<{ amount: number; at: string }>>()
  for (const y of productionYields) {
    const arr = yieldByPrepared.get(y.prepared_ingredient_id) ?? []
    arr.push({ amount: y.yield_base_produced, at: y.produced_at }); yieldByPrepared.set(y.prepared_ingredient_id, arr)
  }
  const consumptionByComponent = new Map<string, Array<{ amount: number; at: string }>>()
  for (const c of productionConsumption) {
    const arr = consumptionByComponent.get(c.component_ingredient_id) ?? []
    arr.push({ amount: c.amount_base_consumed, at: c.produced_at }); consumptionByComponent.set(c.component_ingredient_id, arr)
  }

  const ingredientIds = new Set<string>([...linesByIngredient.keys(), ...eventsByIngredient.keys()])

  const rows: RollingVarianceRow[] = []
  for (const ingId of ingredientIds) {
    const meta = metaByIngredient.get(ingId)
    const ingEvents = eventsByIngredient.get(ingId) ?? []
    if (!meta) continue

    const lines = linesByIngredient.get(ingId) ?? []
    const ingReceipts = receiptsByIngredient.get(ingId) ?? []
    const yieldRows = yieldByPrepared.get(ingId) ?? []
    const consumeRows = consumptionByComponent.get(ingId) ?? []
    const pair = pairLatestCounts(ingEvents.map((e): CountEvent => ({ counted_at: e.counted_at, count_qty: e.count_qty, reason: e.reason })))

    let theoretical = 0
    let actual: number | null = null
    let unmatched = 0
    let deliveries = 0
    let batches = 0
    if (pair) {
      const ws = pair.previous.counted_at
      const we = pair.latest.counted_at
      let rawTheoretical = 0
      for (const line of lines) {
        const buckets = volumesByCocktail.get(line.cocktail_id) ?? []
        rawTheoretical += sumBucketsInWindow(buckets, ws.slice(0, 10), we.slice(0, 10)) * line.pour_ml
      }
      theoretical = applyYield(rawTheoretical, meta.yield_pct)
      // Fold stock movements into the physical drop so deliveries/production are
      // not counted as pour variance (receipts are in bottles -> *pack_size;
      // production yield/consumption are already in base ml).
      const receiptsMl = sumAmountsInWindow(ingReceipts, ws, we) * meta.pack_size
      const prodYieldMl = sumAmountsInWindow(yieldRows, ws, we)
      const prodConsumeMl = sumAmountsInWindow(consumeRows, ws, we)
      actual = (pair.previous.count_qty - pair.latest.count_qty) * meta.pack_size + receiptsMl + prodYieldMl - prodConsumeMl
      deliveries = countInWindow(ingReceipts, ws, we)
      batches = countInWindow(yieldRows, ws, we) + countInWindow(consumeRows, ws, we)
      unmatched = await readUnmatchedInWindow(db, tradeAccountId, ws, we)
    }

    const { variance_ml, variance_pct } = calcVariance(actual, theoretical)
    const variance_cost_p = calcVarianceCostP(variance_ml, meta.pack_size, meta.price_p, meta.purchase_qty)
    const severity = classifyVariance(variance_ml, variance_pct, meta.pack_size)
    const impact_p = Math.round(theoretical * costPerMlP(meta.price_p, meta.pack_size, meta.purchase_qty))

    const sortedEvents = [...ingEvents].sort((a, b) => a.counted_at.localeCompare(b.counted_at))
    const trend: RollingTrendPoint[] = []
    for (let k = 1; k < sortedEvents.length; k++) {
      const prev = sortedEvents[k - 1], cur = sortedEvents[k]
      let rawTheo = 0
      for (const line of lines) {
        const buckets = volumesByCocktail.get(line.cocktail_id) ?? []
        rawTheo += sumBucketsInWindow(buckets, prev.counted_at.slice(0, 10), cur.counted_at.slice(0, 10)) * line.pour_ml
      }
      const theo = applyYield(rawTheo, meta.yield_pct)
      const wsT = prev.counted_at, weT = cur.counted_at
      const receiptsMlT = sumAmountsInWindow(ingReceipts, wsT, weT) * meta.pack_size
      const prodYieldMlT = sumAmountsInWindow(yieldRows, wsT, weT)
      const prodConsumeMlT = sumAmountsInWindow(consumeRows, wsT, weT)
      const act = (prev.count_qty - cur.count_qty) * meta.pack_size + receiptsMlT + prodYieldMlT - prodConsumeMlT
      const v = calcVariance(act, theo)
      trend.push({ counted_at: cur.counted_at, variance_cost_p: calcVarianceCostP(v.variance_ml, meta.pack_size, meta.price_p, meta.purchase_qty), reason: cur.reason })
    }
    const recentTrend = trend.slice(-TREND_LIMIT)
    const persistent = persistentLossFlag(recentTrend.map((t) => t.variance_cost_p))

    rows.push({
      library_ingredient_id: ingId,
      library_name: meta.name,
      pack_size: meta.pack_size,
      price_p: meta.price_p,
      purchase_qty: meta.purchase_qty,
      base_unit: 'ml',
      latest_count_at: ingEvents.length ? sortedEvents[sortedEvents.length - 1].counted_at : null,
      latest_count_qty: ingEvents.length ? sortedEvents[sortedEvents.length - 1].count_qty : null,
      previous_count_at: pair?.previous.counted_at ?? null,
      theoretical_used_ml: theoretical,
      actual_used_ml: actual,
      variance_ml, variance_pct, variance_cost_p, severity,
      impact_p,
      unmatched_in_window: unmatched,
      deliveries_in_window: deliveries,
      batches_in_window: batches,
      latest_reason: pair?.latest.reason ?? null,
      persistent_loss: persistent,
      trend: recentTrend,
    })
  }

  // --- Produce pass (additive; disjoint from the ml loop above) ---
  interface ProduceMeta { name: string; pack_size: number; price_p: number; purchase_qty: number; yield_pct: number; base_unit: 'each' | 'g' }
  const produceMetaByIngredient = new Map<string, ProduceMeta>()
  const produceLinesByIngredient = new Map<string, Array<{ cocktail_id: string; recipe_qty: number; yield_qty: number }>>()
  for (const r of produceRecipes) {
    if (!produceMetaByIngredient.has(r.library_ingredient_id)) {
      produceMetaByIngredient.set(r.library_ingredient_id, {
        name: r.name, pack_size: r.pack_size, price_p: r.price_p,
        purchase_qty: r.purchase_qty, yield_pct: r.yield_pct,
        base_unit: r.base_unit as 'each' | 'g',
      })
    }
    const arr = produceLinesByIngredient.get(r.library_ingredient_id) ?? []
    arr.push({ cocktail_id: r.cocktail_id, recipe_qty: r.recipe_qty, yield_qty: r.yield_qty })
    produceLinesByIngredient.set(r.library_ingredient_id, arr)
  }

  const produceIngredientIds = new Set<string>(produceLinesByIngredient.keys())

  for (const ingId of produceIngredientIds) {
    const meta = produceMetaByIngredient.get(ingId)
    const ingEvents = eventsByIngredient.get(ingId) ?? []
    if (!meta) continue

    const lines = produceLinesByIngredient.get(ingId) ?? []
    const ingReceipts = receiptsByIngredient.get(ingId) ?? []
    const yieldRows = yieldByPrepared.get(ingId) ?? []
    const consumeRows = consumptionByComponent.get(ingId) ?? []
    const pair = pairLatestCounts(ingEvents.map((e): CountEvent => ({ counted_at: e.counted_at, count_qty: e.count_qty, reason: e.reason })))

    let theoretical = 0
    let actual: number | null = null
    let unmatched = 0
    let deliveries = 0
    let batches = 0
    if (pair) {
      const ws = pair.previous.counted_at
      const we = pair.latest.counted_at
      for (const line of lines) {
        const buckets = volumesByCocktail.get(line.cocktail_id) ?? []
        theoretical += sumBucketsInWindow(buckets, ws.slice(0, 10), we.slice(0, 10)) * produceLineUnits(1, line.recipe_qty, line.yield_qty)
      }
      // No applyYield: the per-use yield (yield_qty) is the only conversion; produce yield_pct is 100
      const receiptsUnits = sumAmountsInWindow(ingReceipts, ws, we) * meta.pack_size
      const prodYieldUnits = sumAmountsInWindow(yieldRows, ws, we)
      const prodConsumeUnits = sumAmountsInWindow(consumeRows, ws, we)
      actual = (pair.previous.count_qty - pair.latest.count_qty) * meta.pack_size + receiptsUnits + prodYieldUnits - prodConsumeUnits
      deliveries = countInWindow(ingReceipts, ws, we)
      batches = countInWindow(yieldRows, ws, we) + countInWindow(consumeRows, ws, we)
      unmatched = await readUnmatchedInWindow(db, tradeAccountId, ws, we)
    }

    const { variance_ml, variance_pct } = calcVariance(actual, theoretical)
    const usableCostP = usableCostPerBaseUnitP(meta.price_p, meta.purchase_qty, meta.pack_size, meta.yield_pct)
    const variance_cost_p = variance_ml !== null ? Math.round(variance_ml * usableCostP) : null
    const severity = classifyVariance(variance_ml, variance_pct, meta.pack_size)
    const impact_p = Math.round(theoretical * usableCostP)

    const sortedEvents = [...ingEvents].sort((a, b) => a.counted_at.localeCompare(b.counted_at))
    const trend: RollingTrendPoint[] = []
    for (let k = 1; k < sortedEvents.length; k++) {
      const prev = sortedEvents[k - 1], cur = sortedEvents[k]
      let trendTheo = 0
      for (const line of lines) {
        const buckets = volumesByCocktail.get(line.cocktail_id) ?? []
        trendTheo += sumBucketsInWindow(buckets, prev.counted_at.slice(0, 10), cur.counted_at.slice(0, 10)) * produceLineUnits(1, line.recipe_qty, line.yield_qty)
      }
      const wsT = prev.counted_at, weT = cur.counted_at
      const receiptsT = sumAmountsInWindow(ingReceipts, wsT, weT) * meta.pack_size
      const prodYieldT = sumAmountsInWindow(yieldRows, wsT, weT)
      const prodConsumeT = sumAmountsInWindow(consumeRows, wsT, weT)
      const act = (prev.count_qty - cur.count_qty) * meta.pack_size + receiptsT + prodYieldT - prodConsumeT
      const v = calcVariance(act, trendTheo)
      trend.push({
        counted_at: cur.counted_at,
        variance_cost_p: v.variance_ml !== null ? Math.round(v.variance_ml * usableCostP) : null,
        reason: cur.reason,
      })
    }
    const recentTrend = trend.slice(-TREND_LIMIT)
    const persistent = persistentLossFlag(recentTrend.map((t) => t.variance_cost_p))

    rows.push({
      library_ingredient_id: ingId,
      library_name: meta.name,
      pack_size: meta.pack_size,
      price_p: meta.price_p,
      purchase_qty: meta.purchase_qty,
      base_unit: meta.base_unit,
      latest_count_at: ingEvents.length ? sortedEvents[sortedEvents.length - 1].counted_at : null,
      latest_count_qty: ingEvents.length ? sortedEvents[sortedEvents.length - 1].count_qty : null,
      previous_count_at: pair?.previous.counted_at ?? null,
      theoretical_used_ml: theoretical,
      actual_used_ml: actual,
      variance_ml, variance_pct, variance_cost_p, severity,
      impact_p,
      unmatched_in_window: unmatched,
      deliveries_in_window: deliveries,
      batches_in_window: batches,
      latest_reason: pair?.latest.reason ?? null,
      persistent_loss: persistent,
      trend: recentTrend,
    })
  }

  rows.sort((a, b) => (b.impact_p - a.impact_p) || a.library_name.localeCompare(b.library_name))
  return rows
}
