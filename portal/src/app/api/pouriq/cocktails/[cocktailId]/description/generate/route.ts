// POST /api/pouriq/cocktails/[cocktailId]/description/generate
//   Generates a description using the tenant Voice Profile. Returns { description }.
//
// PUT  /api/pouriq/cocktails/[cocktailId]/description
//   Body: { description: string | null }
//   Saves (or clears) the description on the cocktail.

import { NextResponse } from 'next/server'
import * as Sentry from '@/lib/sentry'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isAllowedOrigin, isRateLimited } from '@/lib/kv'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { getVoiceProfile } from '@/lib/pouriq/voice-profile'
import { generateDescriptionWithAnthropic, type CocktailForCopy } from '@/lib/pouriq/menu-copy'

export const runtime = 'nodejs'

const GENERATE_RATE_LIMIT = 200 // per hour per tenant; covers single + bulk paths

interface Params {
  params: Promise<{ cocktailId: string }>
}

interface CocktailLookup {
  id: string
  menu_id: string
  trade_account_id: string
  name: string
  sale_price_p: number | null
}

async function loadCocktailForTenant(
  db: D1Database,
  cocktailId: string,
  tradeAccountId: string,
): Promise<CocktailLookup | null> {
  const row = await db
    .prepare(`
      SELECT c.id AS id, c.menu_id AS menu_id, m.trade_account_id AS trade_account_id,
             c.name AS name, c.sale_price_p AS sale_price_p
      FROM pouriq_cocktails c
      JOIN pouriq_menus m ON m.id = c.menu_id
      WHERE c.id = ?1 AND m.trade_account_id = ?2
    `)
    .bind(cocktailId, tradeAccountId)
    .first<CocktailLookup>()
  return row ?? null
}

async function loadCocktailForCopy(
  db: D1Database,
  cocktailId: string,
): Promise<CocktailForCopy> {
  const head = await db
    .prepare(`SELECT name, sale_price_p FROM pouriq_cocktails WHERE id = ?1`)
    .bind(cocktailId)
    .first<{ name: string; sale_price_p: number | null }>()
  const ings = await db
    .prepare(`
      SELECT lib.name AS name, i.pour_ml AS pour_ml, i.unit_count AS unit_count
      FROM pouriq_ingredients i
      JOIN pouriq_ingredients_library lib ON lib.id = i.library_ingredient_id
      WHERE i.cocktail_id = ?1
    `)
    .bind(cocktailId)
    .all<{ name: string; pour_ml: number | null; unit_count: number | null }>()
  return {
    name: head?.name ?? '',
    sale_price_p: head?.sale_price_p ?? null,
    abv: null, // pouriq_cocktails has no ABV column; reserved for future use
    ingredients: ings.results ?? [],
  }
}

export async function POST(request: Request, { params }: Params) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { cocktailId } = await params
  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace
  const db = env.DB as D1Database

  if (!env.ANTHROPIC_API_KEY) {
    Sentry.captureMessage('pouriq-description-generate: ANTHROPIC_API_KEY missing', {
      tags: { route: 'pouriq-description-generate', phase: 'config' },
    })
    return NextResponse.json({ error: 'Description generation is temporarily unavailable.' }, { status: 503 })
  }

  if (await isRateLimited(kv, 'pouriq-description-gen', access.tradeAccountId, GENERATE_RATE_LIMIT, 3600)) {
    return NextResponse.json({ error: 'Too many generations. Please try again later.' }, { status: 429 })
  }

  const cocktail = await loadCocktailForTenant(db, cocktailId, access.tradeAccountId)
  if (!cocktail) return NextResponse.json({ error: 'Cocktail not found' }, { status: 404 })

  const profile = await getVoiceProfile(db, access.tradeAccountId)
  if (!profile) {
    return NextResponse.json(
      { error: 'Set your Voice Profile first.', settings_url: '/settings/voice-profile' },
      { status: 400 },
    )
  }

  const cocktailForCopy = await loadCocktailForCopy(db, cocktailId)

  try {
    const description = await generateDescriptionWithAnthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      profile,
      cocktail: cocktailForCopy,
    })
    return NextResponse.json({ description })
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'pouriq-description-generate', phase: 'anthropic' } })
    return NextResponse.json({ error: 'Could not generate a description. Try again.' }, { status: 502 })
  }
}

export async function PUT(request: Request, { params }: Params) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { cocktailId } = await params
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database

  const cocktail = await loadCocktailForTenant(db, cocktailId, access.tradeAccountId)
  if (!cocktail) return NextResponse.json({ error: 'Cocktail not found' }, { status: 404 })

  let body: { description: string | null }
  try {
    body = (await request.json()) as { description: string | null }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const description = body.description === null ? null : String(body.description).trim()
  if (description !== null && description.length > 2000) {
    return NextResponse.json({ error: 'Description is too long (max 2000 chars).' }, { status: 400 })
  }

  await db
    .prepare(`
      UPDATE pouriq_cocktails
      SET description = ?1, description_updated_at = CASE WHEN ?1 IS NULL THEN NULL ELSE datetime('now') END
      WHERE id = ?2
    `)
    .bind(description, cocktailId)
    .run()

  return NextResponse.json({ description })
}
