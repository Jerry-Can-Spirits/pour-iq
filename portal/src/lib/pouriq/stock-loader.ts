import 'server-only'
import { sumBucketsInWindow, canonTs, produceLineUnits } from './variance'
import { computeOnHandBottles, reorderQty } from './stock'
import { sumProductionAfter, readProductionYields, readProductionConsumption } from './prepared'

export interface RollingStockRow {
  library_ingredient_id: string
  library_name: string
  pack_size: number
  pack_format: string | null
  yield_pct: number
  is_prepared: number
  base_unit: 'ml' | 'each' | 'g'
  on_hand_bottles: number | null
  needs_opening_count: boolean
  anchor_count_at: string | null
  anchor_count_qty: number | null
  receipts_since: number
  expected_usage_bottles: number
  par_bottles: number | null
  needs_reorder: boolean
  reorder_qty: number
}

// The stockable universe: every ml-priced library ingredient, whether or not
// it appears in a recipe. Usage is recipe-derived (0 when an ingredient is
// stocked but used in no cocktail/serve).
interface LibraryMetaRow { id: string; name: string; pack_size: number; pack_format: string | null; yield_pct: number; is_prepared: number; par_bottles: number | null }
interface LibraryMetaDbRow { id: string; name: string; pack_size: number; pack_format: string | null; yield_pct: number; is_prepared: number; par_bottles: number | null }
interface RecipeLineRow { cocktail_id: string; library_ingredient_id: string; pour_ml: number }
interface VolumeRow { cocktail_id: string; period_start: string; period_end: string; units_sold: number }
interface EventRow { library_ingredient_id: string; counted_at: string; count_qty: number }
interface ReceiptRow { library_ingredient_id: string; received_at: string; qty: number }

async function readTenantLibrary(db: D1Database, tradeAccountId: string): Promise<LibraryMetaRow[]> {
  const res = await db.prepare(`
    SELECT id, name, pack_size, pack_format, yield_pct, is_prepared, par_bottles
    FROM pouriq_ingredients_library
    WHERE trade_account_id = ?1 AND base_unit = 'ml' AND price_p > 0
  `).bind(tradeAccountId).all<LibraryMetaDbRow>()
  return (res.results ?? []).map((r) => ({ ...r }))
}

async function readTenantRecipes(db: D1Database, tradeAccountId: string): Promise<RecipeLineRow[]> {
  const res = await db.prepare(`
    SELECT c.id AS cocktail_id, i.library_ingredient_id AS library_ingredient_id, i.pour_ml AS pour_ml
    FROM pouriq_cocktails c
    JOIN pouriq_menus m ON m.id = c.menu_id
    JOIN pouriq_ingredients i ON i.cocktail_id = c.id
    WHERE m.trade_account_id = ?1 AND i.pour_ml IS NOT NULL
  `).bind(tradeAccountId).all<RecipeLineRow>()
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
    SELECT library_ingredient_id, counted_at, count_qty
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

interface ProduceRecipeLineRow {
  cocktail_id: string
  library_ingredient_id: string
  recipe_qty: number
  yield_qty: number
  base_unit: string
  name: string
  pack_size: number
  pack_format: string | null
  yield_pct: number
  par_bottles: number | null
}

async function readTenantProduceRecipes(db: D1Database, tradeAccountId: string): Promise<ProduceRecipeLineRow[]> {
  const res = await db.prepare(`
    SELECT c.id AS cocktail_id, i.library_ingredient_id AS library_ingredient_id,
           i.recipe_qty AS recipe_qty, u.yield_qty AS yield_qty,
           lib.base_unit AS base_unit, lib.name AS name, lib.pack_size AS pack_size,
           lib.pack_format AS pack_format, lib.yield_pct AS yield_pct, lib.par_bottles AS par_bottles
    FROM pouriq_cocktails c
    JOIN pouriq_menus m ON m.id = c.menu_id
    JOIN pouriq_ingredients i ON i.cocktail_id = c.id
    JOIN pouriq_ingredients_library lib ON lib.id = i.library_ingredient_id
    JOIN pouriq_ingredient_uses u ON u.id = i.use_id
    WHERE m.trade_account_id = ?1
      AND lib.base_unit IN ('each', 'g') AND lib.price_p > 0 AND i.use_id IS NOT NULL
  `).bind(tradeAccountId).all<ProduceRecipeLineRow>()
  return (res.results ?? []).map((r) => ({ ...r }))
}

export async function loadStockLevels(db: D1Database, tradeAccountId: string): Promise<RollingStockRow[]> {
  const [library, recipes, volumes, events, receipts, productionYields, productionConsumption, produceRecipes] = await Promise.all([
    readTenantLibrary(db, tradeAccountId),
    readTenantRecipes(db, tradeAccountId),
    readTenantVolumes(db, tradeAccountId),
    readTenantEvents(db, tradeAccountId),
    readTenantReceipts(db, tradeAccountId),
    readProductionYields(db, tradeAccountId),
    readProductionConsumption(db, tradeAccountId),
    readTenantProduceRecipes(db, tradeAccountId),
  ])

  const volumesByCocktail = new Map<string, VolumeRow[]>()
  for (const v of volumes) {
    const arr = volumesByCocktail.get(v.cocktail_id) ?? []
    arr.push(v); volumesByCocktail.set(v.cocktail_id, arr)
  }

  // Recipe pour lines per ingredient (for theoretical usage). Lines for
  // non-bottle-priced ingredients are simply never looked up (only library ids
  // below are iterated).
  const linesByIngredient = new Map<string, Array<{ cocktail_id: string; pour_ml: number }>>()
  for (const r of recipes) {
    const arr = linesByIngredient.get(r.library_ingredient_id) ?? []
    arr.push({ cocktail_id: r.cocktail_id, pour_ml: r.pour_ml })
    linesByIngredient.set(r.library_ingredient_id, arr)
  }

  const eventsByIngredient = new Map<string, EventRow[]>()
  for (const e of events) {
    const arr = eventsByIngredient.get(e.library_ingredient_id) ?? []
    arr.push(e); eventsByIngredient.set(e.library_ingredient_id, arr)
  }

  const receiptsByIngredient = new Map<string, ReceiptRow[]>()
  for (const r of receipts) {
    const arr = receiptsByIngredient.get(r.library_ingredient_id) ?? []
    arr.push(r); receiptsByIngredient.set(r.library_ingredient_id, arr)
  }

  const yieldByPrepared = new Map<string, Array<{ amount: number; produced_at: string }>>()
  for (const y of productionYields) {
    const arr = yieldByPrepared.get(y.prepared_ingredient_id) ?? []
    arr.push({ amount: y.yield_base_produced, produced_at: y.produced_at })
    yieldByPrepared.set(y.prepared_ingredient_id, arr)
  }

  const consumptionByComponent = new Map<string, Array<{ amount: number; produced_at: string }>>()
  for (const c of productionConsumption) {
    const arr = consumptionByComponent.get(c.component_ingredient_id) ?? []
    arr.push({ amount: c.amount_base_consumed, produced_at: c.produced_at })
    consumptionByComponent.set(c.component_ingredient_id, arr)
  }

  // Usage window runs from the anchor count to the far future so the CURRENT open
  // POS period (whose bucket period_end is later than today) is still counted.
  // Without this, mid-week/mid-month sales would not draw down on-hand until the
  // period closed. Buckets are keyed by (cocktail, period) so each counts once.
  const WINDOW_END = '9999-12-31'

  const rows: RollingStockRow[] = []
  for (const meta of library) {
    const ingId = meta.id
    const ingEvents = eventsByIngredient.get(ingId) ?? []
    const ingReceipts = receiptsByIngredient.get(ingId) ?? []
    const lines = linesByIngredient.get(ingId) ?? []
    // ingEvents already sorted ascending by counted_at from the DB query
    const anchor = ingEvents.length > 0 ? ingEvents[ingEvents.length - 1] : null

    if (anchor === null) {
      const receiptsSince = ingReceipts.reduce((sum, r) => sum + r.qty, 0)
      rows.push({
        library_ingredient_id: ingId,
        library_name: meta.name,
        pack_size: meta.pack_size,
        pack_format: meta.pack_format,
        yield_pct: meta.yield_pct,
        is_prepared: meta.is_prepared,
        base_unit: 'ml',
        on_hand_bottles: null,
        needs_opening_count: true,
        anchor_count_at: null,
        anchor_count_qty: null,
        receipts_since: receiptsSince,
        expected_usage_bottles: 0,
        par_bottles: meta.par_bottles,
        needs_reorder: false,
        reorder_qty: 0,
      })
    } else {
      const receiptsSince = ingReceipts
        .filter((r) => canonTs(r.received_at) > canonTs(anchor.counted_at))
        .reduce((sum, r) => sum + r.qty, 0)

      let usageSinceMl = 0
      for (const line of lines) {
        const buckets = volumesByCocktail.get(line.cocktail_id) ?? []
        usageSinceMl += sumBucketsInWindow(buckets, anchor.counted_at.slice(0, 10), WINDOW_END) * line.pour_ml
      }

      const prodYieldBase = sumProductionAfter(yieldByPrepared.get(ingId) ?? [], anchor.counted_at)
      const prodConsumeBase = sumProductionAfter(consumptionByComponent.get(ingId) ?? [], anchor.counted_at)

      const on_hand = computeOnHandBottles({
        anchorCountQty: anchor.count_qty,
        receiptsSinceBottles: receiptsSince + prodYieldBase / meta.pack_size,
        usageSinceMl,
        bottleSizeMl: meta.pack_size,
        yieldPct: meta.yield_pct,
      }) - prodConsumeBase / meta.pack_size

      const totalReceiptsSince = receiptsSince + prodYieldBase / meta.pack_size
      const expected_usage_bottles = anchor.count_qty + totalReceiptsSince - on_hand
      const reorder_qty = reorderQty(on_hand, meta.par_bottles)

      rows.push({
        library_ingredient_id: ingId,
        library_name: meta.name,
        pack_size: meta.pack_size,
        pack_format: meta.pack_format,
        yield_pct: meta.yield_pct,
        is_prepared: meta.is_prepared,
        base_unit: 'ml',
        on_hand_bottles: on_hand,
        needs_opening_count: false,
        anchor_count_at: anchor.counted_at,
        anchor_count_qty: anchor.count_qty,
        receipts_since: totalReceiptsSince,
        expected_usage_bottles,
        par_bottles: meta.par_bottles,
        needs_reorder: reorder_qty > 0,
        reorder_qty,
      })
    }
  }

  // --- Produce pass (additive; disjoint from the ml loop above) ---
  interface ProduceMeta { name: string; pack_size: number; pack_format: string | null; yield_pct: number; base_unit: 'each' | 'g'; par_bottles: number | null }
  const produceMetaByIngredient = new Map<string, ProduceMeta>()
  const produceLinesByIngredient = new Map<string, Array<{ cocktail_id: string; recipe_qty: number; yield_qty: number }>>()
  for (const r of produceRecipes) {
    if (!produceMetaByIngredient.has(r.library_ingredient_id)) {
      produceMetaByIngredient.set(r.library_ingredient_id, {
        name: r.name, pack_size: r.pack_size, pack_format: r.pack_format,
        yield_pct: r.yield_pct, base_unit: r.base_unit as 'each' | 'g',
        par_bottles: r.par_bottles,
      })
    }
    const arr = produceLinesByIngredient.get(r.library_ingredient_id) ?? []
    arr.push({ cocktail_id: r.cocktail_id, recipe_qty: r.recipe_qty, yield_qty: r.yield_qty })
    produceLinesByIngredient.set(r.library_ingredient_id, arr)
  }

  for (const [ingId, meta] of produceMetaByIngredient) {
    const ingEvents = eventsByIngredient.get(ingId) ?? []
    const ingReceipts = receiptsByIngredient.get(ingId) ?? []
    const lines = produceLinesByIngredient.get(ingId) ?? []
    const anchor = ingEvents.length > 0 ? ingEvents[ingEvents.length - 1] : null

    if (anchor === null) {
      const receiptsSince = ingReceipts.reduce((sum, r) => sum + r.qty, 0)
      rows.push({
        library_ingredient_id: ingId,
        library_name: meta.name,
        pack_size: meta.pack_size,
        pack_format: meta.pack_format,
        yield_pct: meta.yield_pct,
        is_prepared: 0,
        base_unit: meta.base_unit,
        on_hand_bottles: null,
        needs_opening_count: true,
        anchor_count_at: null,
        anchor_count_qty: null,
        receipts_since: receiptsSince,
        expected_usage_bottles: 0,
        par_bottles: meta.par_bottles,
        needs_reorder: false,
        reorder_qty: 0,
      })
    } else {
      const receiptsSince = ingReceipts
        .filter((r) => canonTs(r.received_at) > canonTs(anchor.counted_at))
        .reduce((sum, r) => sum + r.qty, 0)

      let usageSince = 0
      for (const line of lines) {
        const buckets = volumesByCocktail.get(line.cocktail_id) ?? []
        usageSince += sumBucketsInWindow(buckets, anchor.counted_at.slice(0, 10), WINDOW_END) * produceLineUnits(1, line.recipe_qty, line.yield_qty)
      }

      // On-hand in individual units (each/g), matching usageSince and the
      // rolling loader: counts + receipts are in packs, so scale by pack_size.
      const on_hand = anchor.count_qty * meta.pack_size + receiptsSince * meta.pack_size - usageSince
      const expected_usage_bottles = usageSince
      const reorder_qty = reorderQty(on_hand, meta.par_bottles)

      rows.push({
        library_ingredient_id: ingId,
        library_name: meta.name,
        pack_size: meta.pack_size,
        pack_format: meta.pack_format,
        yield_pct: meta.yield_pct,
        is_prepared: 0,
        base_unit: meta.base_unit,
        on_hand_bottles: on_hand,
        needs_opening_count: false,
        anchor_count_at: anchor.counted_at,
        anchor_count_qty: anchor.count_qty,
        receipts_since: receiptsSince,
        expected_usage_bottles,
        par_bottles: meta.par_bottles,
        needs_reorder: reorder_qty > 0,
        reorder_qty,
      })
    }
  }

  rows.sort((a, b) => a.library_name.localeCompare(b.library_name))
  return rows
}
