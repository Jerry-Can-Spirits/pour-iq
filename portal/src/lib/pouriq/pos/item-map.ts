// POS item → cocktail mapping: alias loading (used by ingest), plus the
// review / mapping / ignore data access used by the API routes.

import { bestGuessCocktail, normalise } from './match'
import { bucketLines, upsertAdditiveVolumes } from './volume-buckets'
import { listCocktailsForMenu, getActiveMenu, listServes, getOrCreateServesMenu } from '../menus'

export interface PosItemAlias {
  normalised_pos_name: string
  cocktail_id: string | null
  cocktail_name: string | null
  ignored: number
}

export async function loadAliases(
  db: D1Database,
  tradeAccountId: string,
): Promise<Map<string, PosItemAlias>> {
  const res = await db
    .prepare(`SELECT normalised_pos_name, cocktail_id, cocktail_name, ignored FROM pouriq_pos_item_map WHERE trade_account_id = ?1`)
    .bind(tradeAccountId)
    .all<PosItemAlias>()
  return new Map((res.results ?? []).map((a) => [a.normalised_pos_name, a]))
}

export interface UnmatchedItem {
  normalised_name: string
  raw_name: string
  total_quantity: number
  last_seen: string
  suggestion: { cocktail_id: string; name: string } | null
}

export async function countUnmatched(db: D1Database, tradeAccountId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(DISTINCT normalised_name) AS c FROM pouriq_pos_unmatched_lines WHERE trade_account_id = ?1`)
    .bind(tradeAccountId)
    .first<{ c: number }>()
  return row?.c ?? 0
}

// Cocktails of the tenant's active menu — the pool we suggest matches from,
// populate the review dropdown with, and the only menu a mapping backfills.
export async function listMappableCocktails(
  db: D1Database,
  tradeAccountId: string,
): Promise<Array<{ id: string; name: string }>> {
  const active = await getActiveMenu(db, tradeAccountId)
  if (!active) return []
  return (await listCocktailsForMenu(db, active.id)).map((c) => ({ id: c.id, name: c.name }))
}

export async function listMappableServes(
  db: D1Database,
  tradeAccountId: string,
): Promise<Array<{ id: string; name: string }>> {
  return (await listServes(db, tradeAccountId)).map((s) => ({ id: s.id, name: s.name }))
}

/**
 * Map a previously-unmatched till name to a serve: persist the alias and
 * backfill the logged lines using the active menu's cadence (serves are
 * menu-independent; we use the active menu's cadence as the tenant default).
 * Throws if the serve does not belong to the tenant.
 */
export async function createServeMapping(
  db: D1Database,
  tradeAccountId: string,
  normalisedName: string,
  serveId: string,
): Promise<void> {
  const servesMenuId = await getOrCreateServesMenu(db, tradeAccountId)
  const serve = await db
    .prepare(`SELECT id, name FROM pouriq_cocktails WHERE id = ?1 AND menu_id = ?2 AND is_serve = 1`)
    .bind(serveId, servesMenuId)
    .first<{ id: string; name: string }>()
  if (!serve) throw new Error('Serve not found for this account')

  await db
    .prepare(`
      INSERT INTO pouriq_pos_item_map (trade_account_id, normalised_pos_name, cocktail_id, cocktail_name, ignored)
      VALUES (?1, ?2, ?3, ?4, 0)
      ON CONFLICT(trade_account_id, normalised_pos_name) DO UPDATE SET
        cocktail_id = excluded.cocktail_id,
        cocktail_name = excluded.cocktail_name,
        ignored = 0,
        updated_at = datetime('now')
    `)
    .bind(tradeAccountId, normalisedName, serveId, normalise(serve.name))
    .run()

  const linesRes = await db
    .prepare(`SELECT id, quantity, sold_at FROM pouriq_pos_unmatched_lines WHERE trade_account_id = ?1 AND normalised_name = ?2`)
    .bind(tradeAccountId, normalisedName)
    .all<{ id: string; quantity: number; sold_at: string }>()
  const lines = linesRes.results ?? []
  if (lines.length === 0) return

  const active = await getActiveMenu(db, tradeAccountId)
  const cadence = active?.volume_cadence ?? 'weekly'
  await upsertAdditiveVolumes(
    db,
    bucketLines(
      { volume_cadence: cadence },
      lines.map((l) => ({ cocktail_id: serveId, quantity: l.quantity, sold_at: l.sold_at })),
    ),
  )
  await db.batch(
    lines.map((l) => db.prepare(`DELETE FROM pouriq_pos_unmatched_lines WHERE id = ?1`).bind(l.id)),
  )
}

export async function listUnmatched(db: D1Database, tradeAccountId: string): Promise<UnmatchedItem[]> {
  const res = await db
    .prepare(`
      SELECT normalised_name,
             MAX(raw_name) AS raw_name,
             SUM(quantity) AS total_quantity,
             MAX(sold_at) AS last_seen
      FROM pouriq_pos_unmatched_lines
      WHERE trade_account_id = ?1
      GROUP BY normalised_name
      ORDER BY total_quantity DESC
    `)
    .bind(tradeAccountId)
    .all<{ normalised_name: string; raw_name: string; total_quantity: number; last_seen: string }>()
  const rows = res.results ?? []
  if (rows.length === 0) return []

  const pool = await listMappableCocktails(db, tradeAccountId)
  return rows.map((r) => {
    const guess = bestGuessCocktail(r.raw_name, pool)
    return {
      normalised_name: r.normalised_name,
      raw_name: r.raw_name,
      total_quantity: r.total_quantity,
      last_seen: r.last_seen,
      suggestion: guess ? { cocktail_id: guess.id, name: guess.name } : null,
    }
  })
}

/**
 * Map a previously-unmatched till name to a cocktail: persist the alias and
 * backfill the logged lines. A logged line backfills only when its
 * connection's target menu IS the cocktail's menu (so the cadence is right);
 * other lines are left in the log for a later sync or menu change.
 * Throws if the cocktail does not belong to the tenant.
 */
export async function createMapping(
  db: D1Database,
  tradeAccountId: string,
  normalisedName: string,
  cocktailId: string,
): Promise<void> {
  const cocktail = await db
    .prepare(`
      SELECT c.id, c.menu_id, c.name, m.volume_cadence, m.trade_account_id
      FROM pouriq_cocktails c
      JOIN pouriq_menus m ON m.id = c.menu_id
      WHERE c.id = ?1
    `)
    .bind(cocktailId)
    .first<{ id: string; menu_id: string; name: string; volume_cadence: 'weekly' | 'monthly'; trade_account_id: string }>()
  if (!cocktail || cocktail.trade_account_id !== tradeAccountId) {
    throw new Error('Cocktail not found for this account')
  }

  await db
    .prepare(`
      INSERT INTO pouriq_pos_item_map (trade_account_id, normalised_pos_name, cocktail_id, cocktail_name, ignored)
      VALUES (?1, ?2, ?3, ?4, 0)
      ON CONFLICT(trade_account_id, normalised_pos_name) DO UPDATE SET
        cocktail_id = excluded.cocktail_id,
        cocktail_name = excluded.cocktail_name,
        ignored = 0,
        updated_at = datetime('now')
    `)
    .bind(tradeAccountId, normalisedName, cocktailId, normalise(cocktail.name))
    .run()

  // Backfill only when this cocktail's menu is the active menu (where all
  // POS sales route). Otherwise leave the logged lines for later.
  const active = await getActiveMenu(db, tradeAccountId)
  if (!active || active.id !== cocktail.menu_id) return

  const linesRes = await db
    .prepare(`SELECT id, quantity, sold_at FROM pouriq_pos_unmatched_lines WHERE trade_account_id = ?1 AND normalised_name = ?2`)
    .bind(tradeAccountId, normalisedName)
    .all<{ id: string; quantity: number; sold_at: string }>()
  const lines = linesRes.results ?? []
  if (lines.length === 0) return

  await upsertAdditiveVolumes(
    db,
    bucketLines(
      { volume_cadence: cocktail.volume_cadence },
      lines.map((l) => ({ cocktail_id: cocktailId, quantity: l.quantity, sold_at: l.sold_at })),
    ),
  )

  await db.batch(
    lines.map((l) =>
      db.prepare(`DELETE FROM pouriq_pos_unmatched_lines WHERE id = ?1`).bind(l.id),
    ),
  )
}

export async function ignoreItem(
  db: D1Database,
  tradeAccountId: string,
  normalisedName: string,
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO pouriq_pos_item_map (trade_account_id, normalised_pos_name, cocktail_id, cocktail_name, ignored)
      VALUES (?1, ?2, NULL, NULL, 1)
      ON CONFLICT(trade_account_id, normalised_pos_name) DO UPDATE SET
        cocktail_id = NULL, cocktail_name = NULL, ignored = 1, updated_at = datetime('now')
    `)
    .bind(tradeAccountId, normalisedName)
    .run()
  await db
    .prepare(`DELETE FROM pouriq_pos_unmatched_lines WHERE trade_account_id = ?1 AND normalised_name = ?2`)
    .bind(tradeAccountId, normalisedName)
    .run()
}
