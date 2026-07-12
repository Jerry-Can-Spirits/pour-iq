// GET /api/pouriq/invoices/[id]/pdf — stream the original PDF, access-gated.

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { getInvoice } from '@/lib/pouriq/invoices'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ id: string }>
}

function safeFilename(invoice: { invoice_number: string | null; invoice_date: string | null }): string {
  const parts: string[] = []
  if (invoice.invoice_number) parts.push(invoice.invoice_number.replace(/[^a-zA-Z0-9\-_]/g, ''))
  if (invoice.invoice_date) parts.push(invoice.invoice_date.replace(/[^0-9\-]/g, ''))
  if (parts.length === 0) parts.push('invoice')
  return `${parts.join('-')}.pdf`
}

export async function GET(_request: Request, { params }: Params) {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
  }
  const { id } = await params
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const r2 = env.TRADE_DOCS as R2Bucket
  const invoice = await getInvoice(db, id, access.tradeAccountId)
  if (!invoice) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
  }
  if (!invoice.r2_key) {
    return new Response(JSON.stringify({ error: 'Original PDF not available for this invoice' }), { status: 404, headers: { 'content-type': 'application/json' } })
  }
  const obj = await r2.get(invoice.r2_key)
  if (!obj) {
    return new Response(JSON.stringify({ error: 'PDF missing from storage' }), { status: 404, headers: { 'content-type': 'application/json' } })
  }
  return new Response(obj.body, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${safeFilename(invoice)}"`,
      'cache-control': 'private, max-age=300',
    },
  })
}
