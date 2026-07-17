// POST /api/logout — revoke the trade session server-side and clear its
// cookie. The session is also subject to a sliding idle timeout and an
// absolute cap (see lib/trade-portal/session.ts); this is the manual
// termination path (e.g. a shared bar tablet at end of shift).

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isAllowedOrigin } from '@/lib/kv'
import {
  getTradeSessionCookieValue,
  revokeTradeSession,
  clearTradeSessionCookie,
} from '@/lib/trade-portal/session'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const sid = await getTradeSessionCookieValue()
  if (sid) {
    const { env } = await getCloudflareContext()
    await revokeTradeSession(env.SITE_OPS as KVNamespace, sid)
  }
  await clearTradeSessionCookie()
  return NextResponse.json({ success: true })
}
