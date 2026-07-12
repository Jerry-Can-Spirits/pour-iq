import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isAllowedOrigin } from '@/lib/kv'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { deleteAccountingConnection, getAccountingConnection } from '@/lib/pouriq/accounting/connections'
import { getAccountingAdapter } from '@/lib/pouriq/accounting/providers'
import { isKnownAccountingProvider } from '@/lib/pouriq/accounting/types'

export const runtime = 'nodejs'

interface Params { params: Promise<{ provider: string }> }

export async function POST(request: Request, { params }: Params) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { provider } = await params
  if (!isKnownAccountingProvider(provider)) return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const connection = await getAccountingConnection(db, access.tradeAccountId, provider)
  if (!connection) return NextResponse.json({ error: 'Not connected' }, { status: 404 })

  const adapter = getAccountingAdapter(provider, env)
  if (adapter) {
    try { await adapter.revokeToken(connection) } catch { /* best-effort */ }
  }
  await deleteAccountingConnection(db, access.tradeAccountId, provider)
  return NextResponse.json({ ok: true })
}
