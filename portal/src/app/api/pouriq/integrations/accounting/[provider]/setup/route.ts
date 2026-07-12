import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isAllowedOrigin } from '@/lib/kv'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { getAccountingConnection, saveAccountingSetup } from '@/lib/pouriq/accounting/connections'
import { isKnownAccountingProvider } from '@/lib/pouriq/accounting/types'

export const runtime = 'nodejs'

interface Params { params: Promise<{ provider: string }> }

interface SetupBody {
  tenant_id?: string
  tenant_name?: string
  default_account_code: string
  default_tax_code: string
}

export async function POST(request: Request, { params }: Params) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { provider } = await params
  if (!isKnownAccountingProvider(provider)) return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })

  let body: SetupBody
  try {
    body = (await request.json()) as SetupBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.default_account_code || typeof body.default_account_code !== 'string') {
    return NextResponse.json({ error: 'default_account_code required' }, { status: 400 })
  }
  if (!body.default_tax_code || typeof body.default_tax_code !== 'string') {
    return NextResponse.json({ error: 'default_tax_code required' }, { status: 400 })
  }

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const connection = await getAccountingConnection(db, access.tradeAccountId, provider)
  if (!connection) return NextResponse.json({ error: 'Not connected' }, { status: 404 })
  if (connection.external_account_id === '' && !body.tenant_id) {
    return NextResponse.json({ error: 'Choose an organisation first' }, { status: 400 })
  }

  await saveAccountingSetup(db, access.tradeAccountId, provider, {
    external_account_id: body.tenant_id,
    external_account_name: body.tenant_name ?? null,
    default_account_code: body.default_account_code,
    default_tax_code: body.default_tax_code,
  })
  return NextResponse.json({ ok: true })
}
