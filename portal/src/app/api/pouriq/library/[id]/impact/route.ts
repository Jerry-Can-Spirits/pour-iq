// GET /api/pouriq/library/[id]/impact
// Returns the data needed to render a cost-change ripple analysis.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { loadImpactPayload } from '@/lib/pouriq/cost-impact-loader'

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

  const payload = await loadImpactPayload(db, id, access.tradeAccountId)
  if (!payload) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(payload)
}
