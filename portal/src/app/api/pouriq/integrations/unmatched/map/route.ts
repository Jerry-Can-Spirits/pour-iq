// POST /api/pouriq/integrations/unmatched/map
// Maps an unmatched till name to a cocktail and backfills logged sales.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { isAllowedOrigin, isRateLimited } from '@/lib/kv'
import { createMapping, createServeMapping } from '@/lib/pouriq/pos/item-map'

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
  if (await isRateLimited(kv, 'pouriq-item-map', access.tradeAccountId, 120, 3600)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  let body: { normalisedName?: string; cocktailId?: string; serveId?: string; target?: 'cocktail' | 'serve' }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const normalisedName = body.normalisedName?.trim()
  const target = body.target === 'serve' ? 'serve' : 'cocktail'
  const db = env.DB as D1Database

  if (target === 'serve') {
    const serveId = body.serveId?.trim()
    if (!normalisedName || !serveId) {
      return NextResponse.json({ error: 'normalisedName and serveId are required' }, { status: 400 })
    }
    try {
      await createServeMapping(db, access.tradeAccountId, normalisedName, serveId)
      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json({ error: 'That serve is not available on this account' }, { status: 422 })
    }
  }

  const cocktailId = body.cocktailId?.trim()
  if (!normalisedName || !cocktailId) {
    return NextResponse.json({ error: 'normalisedName and cocktailId are required' }, { status: 400 })
  }
  try {
    await createMapping(db, access.tradeAccountId, normalisedName, cocktailId)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'That cocktail is not available on this account' }, { status: 422 })
  }
}
