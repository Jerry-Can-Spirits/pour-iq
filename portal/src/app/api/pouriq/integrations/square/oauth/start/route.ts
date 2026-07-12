import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { createOAuthState } from '@/lib/pouriq/pos/connections'
import { getSquareBaseUrl } from '@/lib/pouriq/pos/providers/square'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const state = await createOAuthState(db, access.tradeAccountId, 'square')

  const redirectUri = new URL('/api/pouriq/integrations/square/oauth/callback', request.url).toString()
  const params = new URLSearchParams({
    client_id: env.SQUARE_APP_ID,
    scope: 'ORDERS_READ ITEMS_READ MERCHANT_PROFILE_READ',
    session: 'false',
    state,
    redirect_uri: redirectUri,
  })
  return NextResponse.redirect(`${getSquareBaseUrl(env)}/oauth2/authorize?${params.toString()}`)
}
