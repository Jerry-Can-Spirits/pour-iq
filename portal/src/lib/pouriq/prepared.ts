import { usableCostPerBaseUnitP } from './calculations'
import type { PreparedComponentRow } from './types'

export interface PreparedComponentCost {
  price_p: number
  purchase_qty: number
  pack_size: number
  yield_pct: number
  amount_base: number
}

// Total cost (pence) of one batch: sum each component's usable cost-per-base x amount.
export function batchCostP(components: PreparedComponentCost[]): number {
  return components.reduce(
    (sum, c) => sum + Math.round(usableCostPerBaseUnitP(c.price_p, c.purchase_qty, c.pack_size, c.yield_pct) * c.amount_base),
    0,
  )
}

export type ComponentGraph = Map<string, string[]> // preparedId -> component ingredient ids

export function transitiveComponents(graph: ComponentGraph, id: string): Set<string> {
  const seen = new Set<string>()
  const stack = [...(graph.get(id) ?? [])]
  while (stack.length) {
    const c = stack.pop()!
    if (seen.has(c)) continue
    seen.add(c)
    for (const cc of graph.get(c) ?? []) stack.push(cc)
  }
  return seen
}

export function wouldCreateCycle(graph: ComponentGraph, prepared: string, candidate: string): boolean {
  if (prepared === candidate) return true
  return transitiveComponents(graph, candidate).has(prepared)
}

// Prepared ingredients that transitively depend on changedId, ordered so a
// prepared ingredient comes AFTER its (affected) components (deepest-first).
export function recomputeOrder(graph: ComponentGraph, changedId: string): string[] {
  const parents = new Map<string, string[]>()
  for (const [p, comps] of graph) for (const c of comps) {
    const arr = parents.get(c) ?? []; arr.push(p); parents.set(c, arr)
  }
  const affected = new Set<string>()
  const stack = [...(parents.get(changedId) ?? [])]
  while (stack.length) {
    const p = stack.pop()!
    if (affected.has(p)) continue
    affected.add(p)
    for (const pp of parents.get(p) ?? []) stack.push(pp)
  }
  const order: string[] = []
  const visited = new Set<string>()
  const visit = (id: string): void => {
    if (visited.has(id)) return
    visited.add(id)
    for (const c of graph.get(id) ?? []) if (affected.has(c)) visit(c)
    if (affected.has(id)) order.push(id)
  }
  for (const id of affected) visit(id)
  return order
}

export async function loadPreparedGraph(db: D1Database, tradeAccountId: string): Promise<ComponentGraph> {
  const res = await db.prepare(`
    SELECT pc.prepared_ingredient_id AS p, pc.component_ingredient_id AS c
    FROM pouriq_prepared_components pc
    JOIN pouriq_ingredients_library lib ON lib.id = pc.prepared_ingredient_id
    WHERE lib.trade_account_id = ?1
  `).bind(tradeAccountId).all<{ p: string; c: string }>()
  const g: ComponentGraph = new Map()
  for (const row of res.results ?? []) {
    const arr = g.get(row.p) ?? []; arr.push(row.c); g.set(row.p, arr)
  }
  return g
}

// Components of a prepared ingredient, joined to each component's current cost
// fields (for the live readout AND recompute).
export interface PreparedComponentWithCost extends PreparedComponentRow {
  component_name: string
  component_base_unit: 'ml' | 'g' | 'each'
  price_p: number
  purchase_qty: number
  pack_size: number
  yield_pct: number
}

export async function listPreparedComponents(db: D1Database, preparedId: string): Promise<PreparedComponentWithCost[]> {
  const res = await db.prepare(`
    SELECT pc.id, pc.prepared_ingredient_id, pc.component_ingredient_id, pc.amount_base, pc.recipe_unit, pc.recipe_qty, pc.created_at,
           lib.name AS component_name, lib.base_unit AS component_base_unit,
           lib.price_p, lib.purchase_qty, lib.pack_size, lib.yield_pct
    FROM pouriq_prepared_components pc
    JOIN pouriq_ingredients_library lib ON lib.id = pc.component_ingredient_id
    WHERE pc.prepared_ingredient_id = ?1
    ORDER BY pc.created_at
  `).bind(preparedId).all<PreparedComponentWithCost>()
  return res.results ?? []
}

// Recompute and persist a prepared ingredient's derived batch cost (price_p).
export async function recomputePreparedCost(db: D1Database, preparedId: string): Promise<number> {
  const comps = await listPreparedComponents(db, preparedId)
  const price_p = batchCostP(comps.map((c) => ({
    price_p: c.price_p, purchase_qty: c.purchase_qty, pack_size: c.pack_size, yield_pct: c.yield_pct, amount_base: c.amount_base,
  })))
  await db.prepare(`UPDATE pouriq_ingredients_library SET price_p = ?1, cost_confidence = 'set', updated_at = datetime('now') WHERE id = ?2`).bind(price_p, preparedId).run()
  return price_p
}

// After an ingredient's cost changes, recompute every prepared ingredient that
// depends on it (transitively), in topological order.
export async function recomputeDependents(db: D1Database, tradeAccountId: string, changedIngredientId: string): Promise<void> {
  const graph = await loadPreparedGraph(db, tradeAccountId)
  for (const id of recomputeOrder(graph, changedIngredientId)) {
    await recomputePreparedCost(db, id)
  }
}

// Sum production amounts (yield or consumption) strictly after an anchor date.
export function sumProductionAfter(rows: Array<{ amount: number; produced_at: string }>, anchorAtISO: string): number {
  return rows.reduce((s, r) => (r.produced_at > anchorAtISO ? s + r.amount : s), 0)
}

export interface ProductionYieldRow { prepared_ingredient_id: string; yield_base_produced: number; produced_at: string }
export interface ProductionConsumptionRow { component_ingredient_id: string; amount_base_consumed: number; produced_at: string }

export async function readProductionYields(db: D1Database, tradeAccountId: string): Promise<ProductionYieldRow[]> {
  const res = await db.prepare(
    `SELECT prepared_ingredient_id, yield_base_produced, produced_at FROM pouriq_production_events WHERE trade_account_id = ?1`
  ).bind(tradeAccountId).all<ProductionYieldRow>()
  return res.results ?? []
}

export async function readProductionConsumption(db: D1Database, tradeAccountId: string): Promise<ProductionConsumptionRow[]> {
  const res = await db.prepare(`
    SELECT pc.component_ingredient_id, pc.amount_base_consumed, pc.produced_at
    FROM pouriq_production_components pc
    JOIN pouriq_production_events pe ON pe.id = pc.production_event_id
    WHERE pe.trade_account_id = ?1
  `).bind(tradeAccountId).all<ProductionConsumptionRow>()
  return res.results ?? []
}
