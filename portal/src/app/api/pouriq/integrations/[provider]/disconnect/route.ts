import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { isAllowedOrigin } from '@/lib/kv'
import { deleteConnection, getConnection } from '@/lib/pouriq/pos/connections'
import { getAdapterForProvider } from '@/lib/pouriq/pos/providers'
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

  // Revoke the token with the provider first, best-effort. A failed
  // revocation never blocks the disconnect.
  const connection = await getConnection(db, access.tradeAccountId, provider)
  if (connection) {
    const adapter = getAdapterForProvider(provider, env)
    await adapter?.revokeToken?.(connection.access_token).catch(() => {})
  }

  await deleteConnection(db, access.tradeAccountId, provider)
  return NextResponse.json({ ok: true })
}
