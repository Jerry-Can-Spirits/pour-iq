import type { IngredientUseRow } from './types'

export async function listUsesForTenant(
  db: D1Database,
  tradeAccountId: string,
): Promise<Map<string, IngredientUseRow[]>> {
  const res = await db
    .prepare(`
      SELECT u.id, u.ingredient_id, u.name, u.recipe_unit, u.yield_qty, u.position, u.created_at
      FROM pouriq_ingredient_uses u
      JOIN pouriq_ingredients_library lib ON lib.id = u.ingredient_id
      WHERE lib.trade_account_id = ?1
      ORDER BY u.ingredient_id, u.position ASC, u.created_at ASC
    `)
    .bind(tradeAccountId)
    .all<IngredientUseRow>()
  const map = new Map<string, IngredientUseRow[]>()
  for (const r of res.results ?? []) {
    const arr = map.get(r.ingredient_id) ?? []
    arr.push(r)
    map.set(r.ingredient_id, arr)
  }
  return map
}

export async function listIngredientUses(
  db: D1Database,
  ingredientId: string,
): Promise<IngredientUseRow[]> {
  const result = await db
    .prepare(`
      SELECT id, ingredient_id, name, recipe_unit, yield_qty, position, created_at
      FROM pouriq_ingredient_uses
      WHERE ingredient_id = ?1
      ORDER BY position ASC, created_at ASC
    `)
    .bind(ingredientId)
    .all<IngredientUseRow>()
  return result.results ?? []
}

export async function replaceIngredientUses(
  db: D1Database,
  ingredientId: string,
  uses: Array<{ name: string; recipe_unit: 'ml' | 'count' | 'g'; yield_qty: number }>,
): Promise<void> {
  const statements: D1PreparedStatement[] = [
    db.prepare(`DELETE FROM pouriq_ingredient_uses WHERE ingredient_id = ?1`).bind(ingredientId),
  ]
  uses.forEach((u, i) => {
    statements.push(
      db
        .prepare(`
          INSERT INTO pouriq_ingredient_uses (ingredient_id, name, recipe_unit, yield_qty, position)
          VALUES (?1, ?2, ?3, ?4, ?5)
        `)
        .bind(ingredientId, u.name, u.recipe_unit, u.yield_qty, i),
    )
  })
  await db.batch(statements)
}
