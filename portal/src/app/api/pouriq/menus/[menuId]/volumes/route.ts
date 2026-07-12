// GET  /api/pouriq/menus/[menuId]/volumes
// POST /api/pouriq/menus/[menuId]/volumes  — upsert a period
//
// Volumes are tenant-scoped via cocktail → menu → trade_account. Both
// methods verify the menu belongs to the caller before reading or writing.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isAllowedOrigin } from '@/lib/kv'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { getMenu, listCocktailsForMenu } from '@/lib/pouriq/menus'
import {
  listVolumesForMenu,
  upsertVolumes,
  currentPeriod,
} from '@/lib/pouriq/volumes'
import { calculateCocktailMetrics } from '@/lib/pouriq/calculations'
import type { DrinkVolumeRow } from '@/lib/pouriq/types'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ menuId: string }>
}

interface PeriodSummary {
  period_start: string
  period_end: string
  total_units: number
  total_contribution_p: number
  entries: DrinkVolumeRow[]
}

export async function GET(request: Request, { params }: Params) {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { menuId } = await params
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database

  const menu = await getMenu(db, menuId, access.tradeAccountId)
  if (!menu) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // The client may pass ?cadence=weekly|monthly to override the menu's
  // stored cadence when computing current_period. This avoids a race
  // when the user toggles the tab — the menu's stored cadence is the
  // source of truth for writes, but the GET for display uses whichever
  // cadence the tab is currently showing.
  const url = new URL(request.url)
  const requestedCadence = url.searchParams.get('cadence')
  const effectiveCadence = requestedCadence === 'weekly' || requestedCadence === 'monthly'
    ? requestedCadence
    : menu.volume_cadence

  const [cocktails, volumes] = await Promise.all([
    listCocktailsForMenu(db, menuId),
    listVolumesForMenu(db, menuId),
  ])

  // Build a margin lookup so the server can return contribution alongside
  // each period summary — saves the client recomputing.
  const marginByCocktail = new Map<string, number>()
  for (const c of cocktails) {
    const m = calculateCocktailMetrics(c, menu.prices_include_vat === 1)
    marginByCocktail.set(c.id, m.margin_p)
  }

  // Group volume rows by period.
  const byPeriod = new Map<string, DrinkVolumeRow[]>()
  for (const v of volumes) {
    const key = `${v.period_start}_${v.period_end}`
    if (!byPeriod.has(key)) byPeriod.set(key, [])
    byPeriod.get(key)!.push(v)
  }

  const periods: PeriodSummary[] = []
  for (const entries of byPeriod.values()) {
    const first = entries[0]
    let total_units = 0
    let total_contribution_p = 0
    for (const e of entries) {
      total_units += e.units_sold
      const margin = marginByCocktail.get(e.cocktail_id) ?? 0
      total_contribution_p += margin * e.units_sold
    }
    periods.push({
      period_start: first.period_start,
      period_end: first.period_end,
      total_units,
      total_contribution_p,
      entries,
    })
  }
  periods.sort((a, b) => b.period_start.localeCompare(a.period_start))

  const current = currentPeriod(effectiveCadence)
  return NextResponse.json({
    cadence: effectiveCadence,
    current_period: current,
    periods,
  })
}

interface UpsertBody {
  period_start: string
  period_end: string
  entries: Array<{ cocktail_id: string; units_sold: number }>
}

function isIsoDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export async function POST(request: Request, { params }: Params) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { menuId } = await params
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database

  const menu = await getMenu(db, menuId, access.tradeAccountId)
  if (!menu) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: UpsertBody
  try { body = await request.json() as UpsertBody } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!isIsoDate(body.period_start) || !isIsoDate(body.period_end)) {
    return NextResponse.json({ error: 'period_start and period_end must be YYYY-MM-DD' }, { status: 400 })
  }
  if (body.period_end < body.period_start) {
    return NextResponse.json({ error: 'period_end must be on or after period_start' }, { status: 400 })
  }
  if (!Array.isArray(body.entries)) {
    return NextResponse.json({ error: 'entries must be an array' }, { status: 400 })
  }
  for (const e of body.entries) {
    if (typeof e.cocktail_id !== 'string' || !e.cocktail_id) {
      return NextResponse.json({ error: 'Each entry needs a cocktail_id' }, { status: 400 })
    }
    if (!Number.isInteger(e.units_sold) || e.units_sold < 0) {
      return NextResponse.json({ error: 'units_sold must be a non-negative integer' }, { status: 400 })
    }
  }

  const result = await upsertVolumes(db, menuId, body.period_start, body.period_end, body.entries)
  return NextResponse.json({ written: result.written })
}
