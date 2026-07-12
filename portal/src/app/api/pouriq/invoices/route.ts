// GET /api/pouriq/invoices — list recent invoices for the tenant.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { listInvoicesForTenant } from '@/lib/pouriq/invoices'

export const runtime = 'nodejs'

export async function GET() {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const invoices = await listInvoicesForTenant(db, access.tradeAccountId)
  return NextResponse.json({ invoices })
}
