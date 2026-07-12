// GET /api/pouriq/menus/[menuId]/logo — serve the menu logo from R2, access-gated.

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { getMenu } from '@/lib/pouriq/menus'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ menuId: string }>
}

export async function GET(_request: Request, { params }: Params) {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
  }
  const { menuId } = await params
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const r2 = env.TRADE_DOCS as R2Bucket

  const menu = await getMenu(db, menuId, access.tradeAccountId)
  if (!menu) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
  }
  if (!menu.logo_r2_key) {
    return new Response(JSON.stringify({ error: 'No logo set for this menu' }), { status: 404, headers: { 'content-type': 'application/json' } })
  }

  const obj = await r2.get(menu.logo_r2_key)
  if (!obj) {
    return new Response(JSON.stringify({ error: 'Logo missing from storage' }), { status: 404, headers: { 'content-type': 'application/json' } })
  }

  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'image/png',
      'cache-control': 'private, max-age=300',
    },
  })
}
