import { NextResponse } from 'next/server'
import * as Sentry from '@/lib/sentry'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { isAllowedOrigin } from '@/lib/kv'
import { getConnection, markSyncSuccess, markSyncError } from '@/lib/pouriq/pos/connections'
import { getAdapterForProvider } from '@/lib/pouriq/pos/providers'
import { ingestOrderLines } from '@/lib/pouriq/pos/ingest'
import { isKnownProvider } from '@/lib/pouriq/pos/types'

export const runtime = 'nodejs'

interface Params { params: Promise<{ provider: string }> }

export async function POST(request: Request, { params }: Params) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { provider } = await params
  if (!isKnownProvider(provider)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const connection = await getConnection(db, access.tradeAccountId, provider)
  if (!connection) {
    return NextResponse.json({ error: 'Not connected' }, { status: 404 })
  }
  const adapter = getAdapterForProvider(provider, env)
  if (!adapter) {
    return NextResponse.json({ error: 'Provider not available' }, { status: 400 })
  }
  // Sync from last_synced_at - 1 hour overlap (for safety), or 7 days
  // back on the very first sync.
  const since = connection.last_synced_at
    ? new Date(new Date(connection.last_synced_at).getTime() - 60 * 60 * 1000)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  try {
    const lines = await adapter.fetchOrdersSince(connection, since)
    const result = await ingestOrderLines(db, connection, lines)
    if (!result.paused) {
      await markSyncSuccess(db, connection.id)
    }
    return NextResponse.json({
      ok: true,
      paused: result.paused === true,
      matched: result.matched,
      unmatched: result.unmatched,
      since: since.toISOString(),
    })
  } catch (e) {
    Sentry.captureException(e, { tags: { route: 'pos-sync', provider } })
    await markSyncError(db, connection.id, (e as Error).message ?? 'unknown').catch(() => {})
    return NextResponse.json({ error: 'sync failed' }, { status: 500 })
  }
}
