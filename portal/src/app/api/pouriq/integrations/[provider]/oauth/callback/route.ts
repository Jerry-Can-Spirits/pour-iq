// Generic OAuth callback for POS providers. Mirrors the Square-specific
// callback (which shadows this route for provider=square); provider comes
// from the path and must match the consumed state row.

import { NextResponse } from 'next/server'
import * as Sentry from '@/lib/sentry'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { consumeOAuthState, upsertConnection } from '@/lib/pouriq/pos/connections'
import { getAdapterForProvider } from '@/lib/pouriq/pos/providers'
import { isKnownProvider } from '@/lib/pouriq/pos/types'

export const runtime = 'nodejs'

interface Params { params: Promise<{ provider: string }> }

export async function GET(request: Request, { params }: Params) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  const settingsUrl = new URL('/settings/integrations', request.url)
  if (error) {
    settingsUrl.searchParams.set('error', error)
    return NextResponse.redirect(settingsUrl)
  }
  if (!code || !state) {
    settingsUrl.searchParams.set('error', 'missing_params')
    return NextResponse.redirect(settingsUrl)
  }

  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { provider } = await params
  if (!isKnownProvider(provider)) {
    settingsUrl.searchParams.set('error', 'missing_params')
    return NextResponse.redirect(settingsUrl)
  }

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const stateRow = await consumeOAuthState(db, state)
  if (!stateRow || stateRow.provider !== provider || stateRow.trade_account_id !== access.tradeAccountId) {
    settingsUrl.searchParams.set('error', 'invalid_state')
    return NextResponse.redirect(settingsUrl)
  }

  const adapter = getAdapterForProvider(provider, env)
  if (!adapter?.exchangeCodeForToken) {
    settingsUrl.searchParams.set('error', 'missing_params')
    return NextResponse.redirect(settingsUrl)
  }

  try {
    const redirectUri = new URL(`/api/pouriq/integrations/${provider}/oauth/callback`, request.url).toString()
    const token = await adapter.exchangeCodeForToken(code, redirectUri)
    await upsertConnection(db, {
      trade_account_id: stateRow.trade_account_id,
      provider,
      external_account_id: token.externalAccountId,
      external_location_id: token.externalLocationId,
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      token_expires_at: token.expiresAt,
      scopes: token.scopes,
      auth_mode: 'oauth',
    })
    settingsUrl.searchParams.set('connected', provider)
    return NextResponse.redirect(settingsUrl)
  } catch (e) {
    const detail = (e as Error)?.message ?? 'unknown'
    console.error(`${provider}-oauth-callback failed:`, detail)
    Sentry.captureException(e, { tags: { route: 'pos-oauth-callback', provider }, extra: { detail } })
    settingsUrl.searchParams.set('error', 'token_exchange_failed')
    settingsUrl.searchParams.set('detail', detail.slice(0, 300))
    return NextResponse.redirect(settingsUrl)
  }
}
