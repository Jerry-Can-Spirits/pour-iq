// GET /api/pouriq/cocktails/[cocktailId]/photo — serve the cocktail photo from R2, access-gated.

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ cocktailId: string }>
}

export async function GET(_request: Request, { params }: Params) {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
  }
  const { cocktailId } = await params
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const r2 = env.TRADE_DOCS as R2Bucket

  // Verify the cocktail belongs to this tenant via its parent menu
  const row = await db
    .prepare(`
      SELECT c.photo_r2_key FROM pouriq_cocktails c
      JOIN pouriq_menus m ON m.id = c.menu_id
      WHERE c.id = ?1 AND m.trade_account_id = ?2
    `)
    .bind(cocktailId, access.tradeAccountId)
    .first<{ photo_r2_key: string | null }>()

  if (!row) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
  }
  if (!row.photo_r2_key) {
    return new Response(JSON.stringify({ error: 'No photo set for this cocktail' }), { status: 404, headers: { 'content-type': 'application/json' } })
  }

  const obj = await r2.get(row.photo_r2_key)
  if (!obj) {
    return new Response(JSON.stringify({ error: 'Photo missing from storage' }), { status: 404, headers: { 'content-type': 'application/json' } })
  }

  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'image/png',
      'cache-control': 'private, max-age=300',
    },
  })
}
