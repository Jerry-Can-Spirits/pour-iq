// POST /api/pouriq/integrations/unmatched/ignore
// Marks an unmatched till item as "not a cocktail" so it stops reappearing.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { isAllowedOrigin, isRateLimited } from '@/lib/kv'
import { ignoreItem } from '@/lib/pouriq/pos/item-map'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace
  if (await isRateLimited(kv, 'pouriq-item-ignore', access.tradeAccountId, 120, 3600)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  let body: { normalisedName?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const normalisedName = body.normalisedName?.trim()
  if (!normalisedName) {
    return NextResponse.json({ error: 'normalisedName is required' }, { status: 400 })
  }

  const db = env.DB as D1Database
  await ignoreItem(db, access.tradeAccountId, normalisedName)
  return NextResponse.json({ ok: true })
}
