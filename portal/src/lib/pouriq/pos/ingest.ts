import type { PosConnection, PosOrderLine } from './types'
import { matchPosItemToCocktail, normalise } from './match'
import { loadAliases } from './item-map'
import { bucketLines, upsertAdditiveVolumes, type CocktailLine } from './volume-buckets'
import { listCocktailsForMenu, getActiveMenu, listServes } from '../menus'

/**
 * Take a batch of POS order lines, resolve each to a cocktail in the
 * tenant's active menu (ignored alias → mapped alias → exact/fuzzy),
 * aggregate by (cocktail, period), and additively upsert into
 * pouriq_drink_volumes. Lines that resolve to nothing are logged to
 * pouriq_pos_unmatched_lines for review and later backfill.
 *
 * When the tenant has no active menu, ingest is paused and returns
 * `paused: true`; callers must skip advancing `last_synced_at` so the next
 * sync backfills orders received while paused.
 */
export async function ingestOrderLines(
  db: D1Database,
  connection: PosConnection,
  lines: PosOrderLine[],
): Promise<{ matched: number; unmatched: number; paused?: boolean }> {
  // Keep the unmatched-line log bounded to the 90-day backfill window.
  await db
    .prepare(`DELETE FROM pouriq_pos_unmatched_lines WHERE created_at < datetime('now','-90 days')`)
    .run()
    .catch(() => {})

  if (lines.length === 0) return { matched: 0, unmatched: 0 }

  // Sales route to the tenant's active menu. No active menu → pause (the next
  // sync after one is set backfills). Dormant menus never receive volume.
  const targetMenu = await getActiveMenu(db, connection.trade_account_id)
  if (!targetMenu) {
    return { matched: 0, unmatched: 0, paused: true }
  }

  // Order-level dedup: the hourly cron re-fetches a one-hour overlap and
  // webhooks can deliver orders the cron later fetches again. Volumes are
  // additive, so each order must be ingested exactly once per connection.
  const orderIds = Array.from(new Set(lines.map((l) => l.external_order_id)))
  const seenResults = await db.batch(
    orderIds.map((oid) =>
      db
        .prepare(`INSERT OR IGNORE INTO pouriq_pos_seen_orders (connection_id, external_order_id) VALUES (?1, ?2)`)
        .bind(connection.id, oid),
    ),
  )
  const freshOrderIds = new Set(orderIds.filter((_, i) => (seenResults[i]?.meta.changes ?? 0) > 0))
  lines = lines.filter((l) => freshOrderIds.has(l.external_order_id))
  if (lines.length === 0) return { matched: 0, unmatched: 0 }

  const cocktails = await listCocktailsForMenu(db, targetMenu.id)
  const cocktailByNormName = new Map(cocktails.map((c) => [normalise(c.name), c]))
  const serves = await listServes(db, connection.trade_account_id)
  const serveById = new Map(serves.map((s) => [s.id, s]))
  const aliases = await loadAliases(db, connection.trade_account_id)

  const matchedLines: CocktailLine[] = []
  const unmatchedLines: PosOrderLine[] = []
  for (const line of lines) {
    const norm = normalise(line.name)
    const alias = aliases.get(norm)
    if (alias?.ignored) continue // suppressed non-cocktail till button

    let cocktailId: string | null = null
    if (alias?.cocktail_id && serveById.has(alias.cocktail_id)) {
      // Serve alias — resolve by id; serves are stable and menu-independent.
      cocktailId = alias.cocktail_id
    } else if (alias?.cocktail_name) {
      // Cocktail alias — resolve by name so the mapping survives a seasonal menu change.
      cocktailId = cocktailByNormName.get(alias.cocktail_name)?.id ?? null
    }
    if (!cocktailId) {
      cocktailId = matchPosItemToCocktail(line.name, cocktails)?.id ?? null
    }

    if (cocktailId) {
      matchedLines.push({ cocktail_id: cocktailId, quantity: line.quantity, sold_at: line.sold_at })
    } else {
      unmatchedLines.push(line)
    }
  }

  await upsertAdditiveVolumes(db, bucketLines(targetMenu, matchedLines))

  if (unmatchedLines.length > 0) {
    await db.batch(
      unmatchedLines.map((l) =>
        db
          .prepare(`
            INSERT INTO pouriq_pos_unmatched_lines
              (connection_id, trade_account_id, normalised_name, raw_name, quantity, sold_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
          `)
          .bind(connection.id, connection.trade_account_id, normalise(l.name), l.name, Math.round(l.quantity), l.sold_at),
      ),
    )
  }

  return { matched: matchedLines.length, unmatched: unmatchedLines.length }
}
