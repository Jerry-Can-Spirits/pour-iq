import type { ServeUnitRow } from './types'

// D1Database is an ambient global in this project — no import, matching siblings.

export async function listServeUnits(db: D1Database, libraryIngredientId: string): Promise<ServeUnitRow[]> {
  const res = await db
    .prepare(
      `SELECT id, library_ingredient_id, name, base_per_unit, created_at
       FROM pouriq_ingredient_serve_units WHERE library_ingredient_id = ?1 ORDER BY name`,
    )
    .bind(libraryIngredientId)
    .all<ServeUnitRow>()
  return res.results ?? []
}

// All of a tenant's serve units, grouped by ingredient id (one query) — for
// recipe entry + spec rendering. Joins to the library to enforce tenant scope.
export async function listServeUnitsForTenant(db: D1Database, tradeAccountId: string): Promise<Map<string, ServeUnitRow[]>> {
  const res = await db
    .prepare(
      `SELECT su.id, su.library_ingredient_id, su.name, su.base_per_unit, su.created_at
       FROM pouriq_ingredient_serve_units su
       JOIN pouriq_ingredients_library lib ON lib.id = su.library_ingredient_id
       WHERE lib.trade_account_id = ?1
       ORDER BY su.library_ingredient_id, su.name`,
    )
    .bind(tradeAccountId)
    .all<ServeUnitRow>()
  const map = new Map<string, ServeUnitRow[]>()
  for (const r of res.results ?? []) {
    const arr = map.get(r.library_ingredient_id) ?? []
    arr.push(r)
    map.set(r.library_ingredient_id, arr)
  }
  return map
}
