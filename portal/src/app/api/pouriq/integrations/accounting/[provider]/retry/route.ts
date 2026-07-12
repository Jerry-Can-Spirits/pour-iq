import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isAllowedOrigin } from '@/lib/kv'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { pushInvoiceWithConnection } from '@/lib/pouriq/accounting/push'
import { getAccountingConnection, isConnectionReady } from '@/lib/pouriq/accounting/connections'
import { getPushForInvoiceProvider } from '@/lib/pouriq/accounting/pushes'
import { isKnownAccountingProvider } from '@/lib/pouriq/accounting/types'

export const runtime = 'nodejs'

interface Params { params: Promise<{ provider: string }> }

export async function POST(request: Request, { params }: Params) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { provider } = await params
  if (!isKnownAccountingProvider(provider)) return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })

  let body: { invoice_id?: string }
  try {
    body = (await request.json()) as { invoice_id?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.invoice_id || typeof body.invoice_id !== 'string') {
    return NextResponse.json({ error: 'invoice_id required' }, { status: 400 })
  }

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const invoice = await db
    .prepare(`SELECT id FROM pouriq_invoices WHERE id = ?1 AND trade_account_id = ?2`)
    .bind(body.invoice_id, access.tradeAccountId)
    .first<{ id: string }>()
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const conn = await getAccountingConnection(db, access.tradeAccountId, provider)
  if (!conn || !isConnectionReady(conn)) return NextResponse.json({ error: 'Not connected' }, { status: 404 })

  await pushInvoiceWithConnection(db, env, conn, body.invoice_id)
  const push = await getPushForInvoiceProvider(db, body.invoice_id, provider)
  return NextResponse.json({ status: push?.status ?? 'failed', error: push?.error ?? null })
}
