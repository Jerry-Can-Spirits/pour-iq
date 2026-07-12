// Generic OAuth start for accounting providers (Xero, QuickBooks).
// Mirrors the POS start route; accounting connections live in their own
// table but share the OAuth state nonce table.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { createAccountingOAuthState } from '@/lib/pouriq/accounting/connections'
import { getAccountingAuthorizeUrl } from '@/lib/pouriq/accounting/providers'
import { isKnownAccountingProvider } from '@/lib/pouriq/accounting/types'

export const runtime = 'nodejs'

interface Params { params: Promise<{ provider: string }> }

export async function GET(request: Request, { params }: Params) {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  const { provider } = await params
  if (!isKnownAccountingProvider(provider)) {
    return NextResponse.redirect(new URL('/settings/integrations?error=missing_params', request.url))
  }
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const state = await createAccountingOAuthState(db, access.tradeAccountId, provider)
  const redirectUri = new URL(`/api/pouriq/integrations/accounting/${provider}/oauth/callback`, request.url).toString()
  const authorizeUrl = await getAccountingAuthorizeUrl(provider, env, state, redirectUri)
  if (!authorizeUrl) {
    return NextResponse.redirect(new URL('/settings/integrations?error=missing_params', request.url))
  }
  return NextResponse.redirect(authorizeUrl)
}
