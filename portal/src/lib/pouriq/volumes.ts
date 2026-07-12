// Volume entry data access. Tenant scoping is enforced by callers
// because volumes are reached via cocktail → menu → trade_account; the
// API routes verify menu ownership before touching this module.

import type { DrinkVolumeRow, VolumeCadence } from './types'

export interface VolumeUpsert {
  cocktail_id: string
  units_sold: number
}

export function currentPeriod(cadence: VolumeCadence, now: Date = new Date()): { start: string; end: string } {
  const d = new Date(now)
  d.setUTCHours(0, 0, 0, 0)
  if (cadence === 'monthly') {
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  }
  // weekly: ISO week (Monday → Sunday, UK convention)
  const day = d.getUTCDay() // 0=Sun..6=Sat
  const offsetToMonday = day === 0 ? -6 : 1 - day
  const start = new Date(d)
  start.setUTCDate(d.getUTCDate() + offsetToMonday)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export async function listVolumesForMenu(
  db: D1Database,
  menuId: string,
): Promise<DrinkVolumeRow[]> {
  const result = await db
    .prepare(`
      SELECT v.id, v.cocktail_id, v.period_start, v.period_end,
             v.units_sold, v.source, v.created_at, v.updated_at
      FROM pouriq_drink_volumes v
      JOIN pouriq_cocktails c ON c.id = v.cocktail_id
      WHERE c.menu_id = ?1
      ORDER BY v.period_start DESC, v.cocktail_id ASC
    `)
    .bind(menuId)
    .all<DrinkVolumeRow>()
  return result.results ?? []
}

export async function listVolumesForPeriod(
  db: D1Database,
  menuId: string,
  period_start: string,
  period_end: string,
): Promise<DrinkVolumeRow[]> {
  const result = await db
    .prepare(`
      SELECT v.id, v.cocktail_id, v.period_start, v.period_end,
             v.units_sold, v.source, v.created_at, v.updated_at
      FROM pouriq_drink_volumes v
      JOIN pouriq_cocktails c ON c.id = v.cocktail_id
      WHERE c.menu_id = ?1 AND v.period_start = ?2 AND v.period_end = ?3
    `)
    .bind(menuId, period_start, period_end)
    .all<DrinkVolumeRow>()
  return result.results ?? []
}

export async function upsertVolumes(
  db: D1Database,
  menuId: string,
  period_start: string,
  period_end: string,
  entries: VolumeUpsert[],
): Promise<{ written: number }> {
  if (entries.length === 0) return { written: 0 }
  // Verify every cocktail_id belongs to this menu before writing.
  const cocktails = await db
    .prepare(`SELECT id FROM pouriq_cocktails WHERE menu_id = ?1`)
    .bind(menuId)
    .all<{ id: string }>()
  const allowed = new Set((cocktails.results ?? []).map((c) => c.id))
  const validEntries = entries.filter((e) => allowed.has(e.cocktail_id))

  const statements: D1PreparedStatement[] = validEntries.map((e) =>
    db
      .prepare(`
        INSERT INTO pouriq_drink_volumes (cocktail_id, period_start, period_end, units_sold, source)
        VALUES (?1, ?2, ?3, ?4, 'manual')
        ON CONFLICT(cocktail_id, period_start, period_end) DO UPDATE SET
          units_sold = excluded.units_sold,
          source = 'manual',
          updated_at = datetime('now')
      `)
      .bind(e.cocktail_id, period_start, period_end, e.units_sold),
  )
  if (statements.length > 0) await db.batch(statements)
  return { written: validEntries.length }
}

export async function updateMenuCadence(
  db: D1Database,
  menuId: string,
  tradeAccountId: string,
  cadence: VolumeCadence,
): Promise<void> {
  await db
    .prepare(`UPDATE pouriq_menus SET volume_cadence = ?1, updated_at = datetime('now') WHERE id = ?2 AND trade_account_id = ?3`)
    .bind(cadence, menuId, tradeAccountId)
    .run()
}
