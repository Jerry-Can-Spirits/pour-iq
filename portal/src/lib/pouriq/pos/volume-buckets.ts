// Shared volume bucketing for POS ingest and mapping backfill, kept in its
// own module so ingest and item-map can both use it without a cycle.

import { currentPeriod } from '../volumes'
import type { MenuRow } from '../types'

export interface BucketEntry {
  cocktailId: string
  periodStart: string
  periodEnd: string
  units: number
}

export interface CocktailLine {
  cocktail_id: string
  quantity: number
  sold_at: string
}

// Pure: turn matched lines into (cocktail, period) buckets using the menu's
// cadence. Shared by live ingest and by mapping backfill so both attribute
// volume identically.
export function bucketLines(menu: Pick<MenuRow, 'volume_cadence'>, lines: CocktailLine[]): BucketEntry[] {
  const bucket = new Map<string, BucketEntry>()
  for (const line of lines) {
    const period = currentPeriod(menu.volume_cadence, new Date(line.sold_at))
    const key = `${line.cocktail_id}::${period.start}::${period.end}`
    const existing = bucket.get(key)
    if (existing) existing.units += line.quantity
    else bucket.set(key, {
      cocktailId: line.cocktail_id,
      periodStart: period.start,
      periodEnd: period.end,
      units: line.quantity,
    })
  }
  return Array.from(bucket.values())
}

// Additive upsert (existing units + new units). POS volume accumulates,
// unlike the manual volumes.ts upsert which REPLACES.
// All bucket upserts are sent as one db.batch so they commit atomically.
// A mid-loop Worker timeout can no longer lose volume for partially-processed buckets.
export async function upsertAdditiveVolumes(db: D1Database, entries: BucketEntry[]): Promise<void> {
  if (entries.length === 0) return
  const stmts = entries.map((v) =>
    db
      .prepare(`
        INSERT INTO pouriq_drink_volumes (cocktail_id, period_start, period_end, units_sold, source)
        VALUES (?1, ?2, ?3, ?4, 'pos')
        ON CONFLICT(cocktail_id, period_start, period_end) DO UPDATE SET
          units_sold = units_sold + excluded.units_sold,
          source = CASE WHEN source = 'manual' THEN 'manual' ELSE 'pos' END,
          updated_at = datetime('now')
      `)
      .bind(v.cocktailId, v.periodStart, v.periodEnd, Math.round(v.units))
  )
  await db.batch(stmts)
}
