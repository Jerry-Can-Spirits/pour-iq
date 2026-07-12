// POST /api/pouriq/integrations/[provider]/connect-key
// Connects an api-key provider: validates the submitted credential fields
// against the provider and upserts the connection.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { isAllowedOrigin, isRateLimited } from '@/lib/kv'
import { upsertConnection } from '@/lib/pouriq/pos/connections'
import { getAdapterForProvider } from '@/lib/pouriq/pos/providers'
import { isKnownProvider, PROVIDER_CREDENTIAL_FIELDS } from '@/lib/pouriq/pos/types'

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
  const declaredFields = PROVIDER_CREDENTIAL_FIELDS[provider]
  if (!declaredFields) {
    return NextResponse.json({ error: 'Provider does not use API key connection' }, { status: 400 })
  }

  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace
  if (await isRateLimited(kv, 'pouriq-connect-key', access.tradeAccountId, 10, 3600)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  let body: { fields?: Record<string, string> }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const fields: Record<string, string> = {}
  for (const f of declaredFields) {
    const value = body.fields?.[f.key]?.trim()
    if (!value) {
      return NextResponse.json({ error: `Missing ${f.label}` }, { status: 400 })
    }
    fields[f.key] = value
  }

  const adapter = getAdapterForProvider(provider, env)
  if (!adapter?.validateCredentials) {
    return NextResponse.json({ error: 'Provider not available' }, { status: 400 })
  }

  try {
    const identity = await adapter.validateCredentials(fields)
    const db = env.DB as D1Database
    await upsertConnection(db, {
      trade_account_id: access.tradeAccountId,
      provider,
      external_account_id: identity.externalAccountId,
      external_location_id: identity.externalLocationId,
      access_token: JSON.stringify(fields),
      refresh_token: null,
      token_expires_at: null,
      scopes: null,
      auth_mode: 'api-key',
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Credentials were rejected by the provider' }, { status: 422 })
  }
}
