import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { listCatalogue, searchCatalogue } from '@/lib/pouriq/ingredient-catalogue'
import { ALL_INGREDIENT_TYPES, type IngredientType } from '@/lib/pouriq/types'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(request.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ results: [] })
  const typeParam = url.searchParams.get('type')
  const type = typeParam && ALL_INGREDIENT_TYPES.includes(typeParam as IngredientType) ? (typeParam as IngredientType) : undefined
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const entries = await listCatalogue(db)
  const results = searchCatalogue(q, entries, type).map((e) => ({
    id: e.id, name: e.name, ingredient_type: e.ingredient_type, base_unit: e.base_unit, default_pack_size: e.default_pack_size,
  }))
  return NextResponse.json({ results })
}
