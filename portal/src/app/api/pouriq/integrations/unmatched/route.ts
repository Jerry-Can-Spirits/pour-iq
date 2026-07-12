// GET /api/pouriq/integrations/unmatched
// Lists the tenant's unmatched POS items (grouped) for the review screen.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { listUnmatched } from '@/lib/pouriq/pos/item-map'

export const runtime = 'nodejs'

export async function GET() {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const items = await listUnmatched(db, access.tradeAccountId)
  return NextResponse.json({ items })
}
