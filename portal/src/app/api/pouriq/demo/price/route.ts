// POST /api/pouriq/demo/price — the price toggle. Records a sale-price
// override for one menu line in the session overlay so its GP
// recalculates. Overlay only — never D1. Body: { cocktail_id, sale_price_p }.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { requireDemoSession } from '@/lib/pouriq/access'
import { setDemoPriceOverride } from '@/lib/pouriq/demo/overlay'
import { DEMO_VENUE_ACCOUNT_ID } from '@/lib/pouriq/demo/config'

export const runtime = 'nodejs'

const MAX_PRICE_P = 100_000 // £1,000 — a generous ceiling for a demo toggle

interface Body {
  cocktail_id?: unknown
  sale_price_p?: unknown
}

export async function POST(request: Request) {
  const sid = await requireDemoSession()
  if (!sid) return NextResponse.json({ error: 'No demo session' }, { status: 403 })

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const cocktailId = typeof body.cocktail_id === 'string' ? body.cocktail_id : null
  const salePriceP = body.sale_price_p
  if (!cocktailId) return NextResponse.json({ error: 'cocktail_id required' }, { status: 400 })
  if (!Number.isInteger(salePriceP) || (salePriceP as number) <= 0 || (salePriceP as number) > MAX_PRICE_P) {
    return NextResponse.json({ error: 'sale_price_p must be a positive integer in pence' }, { status: 400 })
  }

  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace
  const db = env.DB as D1Database

  // The cocktail must belong to the demo venue — a demo session can only
  // ever touch The Signal Box.
  const owned = await db
    .prepare(`
      SELECT 1 FROM pouriq_cocktails c
      JOIN pouriq_menus m ON m.id = c.menu_id
      WHERE c.id = ?1 AND m.trade_account_id = ?2
      LIMIT 1
    `)
    .bind(cocktailId, DEMO_VENUE_ACCOUNT_ID)
    .first<{ 1: number }>()
  if (!owned) return NextResponse.json({ error: 'Unknown cocktail' }, { status: 404 })

  await setDemoPriceOverride(kv, sid, cocktailId, salePriceP as number)
  return NextResponse.json({ ok: true, cocktail_id: cocktailId, sale_price_p: salePriceP })
}
