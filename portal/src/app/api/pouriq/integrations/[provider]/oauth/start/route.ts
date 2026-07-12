// Generic OAuth start for POS providers. Square's static
// /square/oauth/start route shadows this for provider=square, so its
// registered redirect URI keeps working untouched.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { createOAuthState } from '@/lib/pouriq/pos/connections'
import { getOAuthAuthorizeUrl } from '@/lib/pouriq/pos/providers'
import { isKnownProvider } from '@/lib/pouriq/pos/types'

export const runtime = 'nodejs'

interface Params { params: Promise<{ provider: string }> }

export async function GET(request: Request, { params }: Params) {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  const { provider } = await params
  if (!isKnownProvider(provider)) {
    return NextResponse.redirect(new URL('/settings/integrations?error=missing_params', request.url))
  }
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const state = await createOAuthState(db, access.tradeAccountId, provider)
  const redirectUri = new URL(`/api/pouriq/integrations/${provider}/oauth/callback`, request.url).toString()
  const authorizeUrl = getOAuthAuthorizeUrl(provider, env, state, redirectUri)
  if (!authorizeUrl) {
    return NextResponse.redirect(new URL('/settings/integrations?error=missing_params', request.url))
  }
  return NextResponse.redirect(authorizeUrl)
}
