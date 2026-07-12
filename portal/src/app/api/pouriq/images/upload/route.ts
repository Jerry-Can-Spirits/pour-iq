// POST /api/pouriq/images/upload
// multipart/form-data with fields: file (image), target ('menu-logo' | 'drink-photo'), id (menu or cocktail id).
// Returns { ok: true }.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isAllowedOrigin } from '@/lib/kv'
import { checkPourIqAccess } from '@/lib/pouriq/access'

export const runtime = 'nodejs'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Empty file' }, { status: 400 })
  }

  const target = formData.get('target')
  const id = formData.get('id')
  if (typeof target !== 'string' || (target !== 'menu-logo' && target !== 'drink-photo')) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
  }
  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: 'Only PNG, JPEG, and WebP images are accepted' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 5MB limit' }, { status: 413 })
  }

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const r2 = env.TRADE_DOCS as R2Bucket
  const { tradeAccountId } = access

  const buffer = new Uint8Array(await file.arrayBuffer())

  if (target === 'menu-logo') {
    const owns = await db
      .prepare(`SELECT 1 AS one FROM pouriq_menus WHERE id = ?1 AND trade_account_id = ?2`)
      .bind(id, tradeAccountId)
      .first<{ one: number }>()
    if (!owns) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const key = `pouriq-menu-logos/${tradeAccountId}/${id}`
    await r2.put(key, buffer, { httpMetadata: { contentType: file.type } })
    await db
      .prepare(`UPDATE pouriq_menus SET logo_r2_key = ?1, updated_at = datetime('now') WHERE id = ?2 AND trade_account_id = ?3`)
      .bind(key, id, tradeAccountId)
      .run()
  } else {
    // drink-photo: verify the cocktail belongs to this tenant via its parent menu
    const owns = await db
      .prepare(`
        SELECT 1 AS one FROM pouriq_cocktails c
        JOIN pouriq_menus m ON m.id = c.menu_id
        WHERE c.id = ?1 AND m.trade_account_id = ?2
      `)
      .bind(id, tradeAccountId)
      .first<{ one: number }>()
    if (!owns) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const key = `pouriq-drink-photos/${tradeAccountId}/${id}`
    await r2.put(key, buffer, { httpMetadata: { contentType: file.type } })
    await db
      .prepare(`UPDATE pouriq_cocktails SET photo_r2_key = ?1, updated_at = datetime('now') WHERE id = ?2`)
      .bind(key, id)
      .run()
  }

  return NextResponse.json({ ok: true })
}
