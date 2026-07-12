// POST /api/pouriq/menus/[menuId]/descriptions/generate-bulk
//   Body: { force?: boolean }
//   If force is true, regenerates every drink. Otherwise only drinks without
//   an existing description. Returns per-drink result list (description or error).

import { NextResponse } from 'next/server'
import * as Sentry from '@/lib/sentry'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isAllowedOrigin, isRateLimited } from '@/lib/kv'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { getMenu } from '@/lib/pouriq/menus'
import { getVoiceProfile } from '@/lib/pouriq/voice-profile'
import { generateDescriptionWithAnthropic, type CocktailForCopy } from '@/lib/pouriq/menu-copy'

export const runtime = 'nodejs'

const BULK_RATE_LIMIT = 30 // bulk runs per hour per tenant

interface Params {
  params: Promise<{ menuId: string }>
}

interface DrinkRow {
  id: string
  name: string
  sale_price_p: number | null
  description: string | null
}

interface IngredientRow {
  cocktail_id: string
  name: string
  pour_ml: number | null
  unit_count: number | null
}

export interface BulkResult {
  cocktail_id: string
  name: string
  description?: string
  error?: string
}

export async function POST(request: Request, { params }: Params) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { menuId } = await params
  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace
  const db = env.DB as D1Database

  if (!env.ANTHROPIC_API_KEY) {
    Sentry.captureMessage('pouriq-description-bulk: ANTHROPIC_API_KEY missing', {
      tags: { route: 'pouriq-description-bulk', phase: 'config' },
    })
    return NextResponse.json({ error: 'Description generation is temporarily unavailable.' }, { status: 503 })
  }

  if (await isRateLimited(kv, 'pouriq-description-bulk', access.tradeAccountId, BULK_RATE_LIMIT, 3600)) {
    return NextResponse.json({ error: 'Too many bulk runs. Please try again later.' }, { status: 429 })
  }

  const menu = await getMenu(db, menuId, access.tradeAccountId)
  if (!menu) return NextResponse.json({ error: 'Menu not found' }, { status: 404 })

  const profile = await getVoiceProfile(db, access.tradeAccountId)
  if (!profile) {
    return NextResponse.json(
      { error: 'Set your Voice Profile first.', settings_url: '/settings/voice-profile' },
      { status: 400 },
    )
  }

  let body: { force?: boolean } = {}
  try {
    body = (await request.json()) as { force?: boolean }
  } catch {
    // empty body is fine; default to non-force
  }
  const force = body.force === true

  const drinks = (
    await db
      .prepare(`SELECT id, name, sale_price_p, description FROM pouriq_cocktails WHERE menu_id = ?1 ORDER BY name COLLATE NOCASE ASC`)
      .bind(menuId)
      .all<DrinkRow>()
  ).results ?? []
  const targetDrinks = force ? drinks : drinks.filter((d) => d.description === null || d.description.trim() === '')
  if (targetDrinks.length === 0) {
    return NextResponse.json({ results: [], note: 'No drinks need a description.' })
  }

  const ingsAll = (
    await db
      .prepare(`
        SELECT i.cocktail_id AS cocktail_id, lib.name AS name, i.pour_ml AS pour_ml, i.unit_count AS unit_count
        FROM pouriq_ingredients i
        JOIN pouriq_ingredients_library lib ON lib.id = i.library_ingredient_id
        WHERE i.cocktail_id IN (SELECT id FROM pouriq_cocktails WHERE menu_id = ?1)
      `)
      .bind(menuId)
      .all<IngredientRow>()
  ).results ?? []
  const ingsByCocktail = new Map<string, IngredientRow[]>()
  for (const ing of ingsAll) {
    const list = ingsByCocktail.get(ing.cocktail_id) ?? []
    list.push(ing)
    ingsByCocktail.set(ing.cocktail_id, list)
  }

  const results: BulkResult[] = []
  for (const drink of targetDrinks) {
    const cocktail: CocktailForCopy = {
      name: drink.name,
      sale_price_p: drink.sale_price_p,
      abv: null,
      ingredients: (ingsByCocktail.get(drink.id) ?? []).map((i) => ({
        name: i.name,
        pour_ml: i.pour_ml,
        unit_count: i.unit_count,
      })),
    }
    try {
      const description = await generateDescriptionWithAnthropic({
        apiKey: env.ANTHROPIC_API_KEY,
        profile,
        cocktail,
      })
      await db
        .prepare(`UPDATE pouriq_cocktails SET description = ?1, description_updated_at = datetime('now') WHERE id = ?2`)
        .bind(description, drink.id)
        .run()
      results.push({ cocktail_id: drink.id, name: drink.name, description })
    } catch (err) {
      Sentry.captureException(err, {
        tags: { route: 'pouriq-description-bulk', phase: 'anthropic' },
        extra: { cocktail_id: drink.id },
      })
      results.push({
        cocktail_id: drink.id,
        name: drink.name,
        error: (err as Error).message || 'Generation failed',
      })
    }
  }
  return NextResponse.json({ results })
}
