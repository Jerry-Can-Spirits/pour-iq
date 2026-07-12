// GET /api/pouriq/invoices/[id] — invoice header + lines for the tenant.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { getInvoice, listInvoiceLines } from '@/lib/pouriq/invoices'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: Params) {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const invoice = await getInvoice(db, id, access.tradeAccountId)
  if (!invoice) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const lines = await listInvoiceLines(db, id)
  return NextResponse.json({ invoice, lines })
}
