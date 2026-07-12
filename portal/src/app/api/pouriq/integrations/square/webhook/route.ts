import { NextResponse } from 'next/server'
import * as Sentry from '@/lib/sentry'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { createSquareAdapter } from '@/lib/pouriq/pos/providers/square'
import { findConnectionByExternalAccount, markSyncSuccess, markSyncError } from '@/lib/pouriq/pos/connections'
import { ingestOrderLines } from '@/lib/pouriq/pos/ingest'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const adapter = createSquareAdapter({
    SQUARE_APP_ID: env.SQUARE_APP_ID,
    SQUARE_APP_SECRET: env.SQUARE_APP_SECRET,
    SQUARE_WEBHOOK_SIGNATURE_KEY: env.SQUARE_WEBHOOK_SIGNATURE_KEY,
    SQUARE_ENV: env.SQUARE_ENV,
  })

  // We must read the body as text first to verify the signature, then
  // parse as JSON. Reading body twice on a Request isn't allowed.
  const body = await request.text()
  const verified = await adapter.verifyWebhook(request, body)
  if (!verified) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let payload: { merchant_id?: string } & Record<string, unknown>
  try { payload = JSON.parse(body) } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!payload.merchant_id) {
    return NextResponse.json({ ok: true })  // ignore non-merchant events
  }
  const connection = await findConnectionByExternalAccount(db, 'square', payload.merchant_id)
  if (!connection) {
    // Could be a webhook for a tenant who disconnected — silently OK.
    return NextResponse.json({ ok: true })
  }

  try {
    const lines = adapter.parseWebhookPayload(payload)
    let paused = false
    if (lines.length > 0) {
      const result = await ingestOrderLines(db, connection, lines)
      paused = result.paused === true
    }
    // When paused (no target menu yet), don't advance last_synced_at —
    // the next cron poll after a menu is picked will backfill these orders.
    if (!paused) {
      await markSyncSuccess(db, connection.id)
    }
    return NextResponse.json({ ok: true, paused })
  } catch (e) {
    Sentry.captureException(e, { tags: { route: 'square-webhook' } })
    await markSyncError(db, connection.id, (e as Error).message ?? 'unknown').catch(() => {})
    return NextResponse.json({ error: 'ingest failed' }, { status: 500 })
  }
}
