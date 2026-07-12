// GET  /api/pouriq/variance           — rolling stock-count rows for the tenant
// POST /api/pouriq/variance           — append a stock count event
//   body: { library_ingredient_id, count_qty, reason? }

import { NextResponse } from 'next/server'
import * as Sentry from '@/lib/sentry'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isAllowedOrigin, isRateLimited } from '@/lib/kv'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { loadRollingVariance } from '@/lib/pouriq/variance-rolling-loader'
import { VARIANCE_REASONS } from '@/lib/pouriq/types'

export const runtime = 'nodejs'

const SAVE_RATE_LIMIT = 60 // POST per hour per tenant

export async function GET() {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { env } = await getCloudflareContext()
    const db = env.DB as D1Database
    const rows = await loadRollingVariance(db, access.tradeAccountId)
    return NextResponse.json({ rows })
  } catch (e) {
    Sentry.captureException(e, { tags: { feature: 'pouriq-variance-v2/load' } })
    return NextResponse.json({ error: 'load failed' }, { status: 500 })
  }
}

interface PostBody {
  library_ingredient_id?: unknown
  count_qty?: unknown
  reason?: unknown
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace
  const db = env.DB as D1Database

  if (await isRateLimited(kv, 'pouriq-variance-save', access.tradeAccountId, SAVE_RATE_LIMIT, 3600)) {
    return NextResponse.json({ error: 'Too many saves. Please try again later.' }, { status: 429 })
  }

  let body: PostBody
  try {
    body = (await request.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const ingredientId = typeof body.library_ingredient_id === 'string' ? body.library_ingredient_id : ''
  const qty = typeof body.count_qty === 'number' ? body.count_qty : NaN
  const reason =
    typeof body.reason === 'string' && (VARIANCE_REASONS as readonly string[]).includes(body.reason)
      ? body.reason
      : null
  if (!ingredientId || !Number.isFinite(qty) || qty < 0) {
    return NextResponse.json(
      { error: 'library_ingredient_id and a non-negative count_qty are required' },
      { status: 400 },
    )
  }

  try {
    const owns = await db
      .prepare(`SELECT 1 FROM pouriq_ingredients_library WHERE id = ?1 AND trade_account_id = ?2`)
      .bind(ingredientId, access.tradeAccountId)
      .first()
    if (!owns) return NextResponse.json({ error: 'ingredient not found' }, { status: 404 })

    await db
      .prepare(
        `INSERT INTO pouriq_stock_count_events (trade_account_id, library_ingredient_id, counted_at, count_qty, reason)
         VALUES (?1, ?2, datetime('now'), ?3, ?4)`,
      )
      .bind(access.tradeAccountId, ingredientId, qty, reason)
      .run()

    const rows = await loadRollingVariance(db, access.tradeAccountId)
    return NextResponse.json({ rows })
  } catch (e) {
    Sentry.captureException(e, { tags: { feature: 'pouriq-variance-v2/save' } })
    return NextResponse.json({ error: 'save failed' }, { status: 500 })
  }
}
