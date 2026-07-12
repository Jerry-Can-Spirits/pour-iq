import { NextResponse } from 'next/server'
import * as Sentry from '@/lib/sentry'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { consumeOAuthState, upsertConnection } from '@/lib/pouriq/pos/connections'
import { createSquareAdapter } from '@/lib/pouriq/pos/providers/square'

export const runtime = 'nodejs'

export async function GET(request: Request) {
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

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const stateRow = await consumeOAuthState(db, state)
  if (!stateRow || stateRow.provider !== 'square' || stateRow.trade_account_id !== access.tradeAccountId) {
    settingsUrl.searchParams.set('error', 'invalid_state')
    return NextResponse.redirect(settingsUrl)
  }

  try {
    const adapter = createSquareAdapter({
      SQUARE_APP_ID: env.SQUARE_APP_ID,
      SQUARE_APP_SECRET: env.SQUARE_APP_SECRET,
      SQUARE_WEBHOOK_SIGNATURE_KEY: env.SQUARE_WEBHOOK_SIGNATURE_KEY,
      SQUARE_ENV: env.SQUARE_ENV,
    })
    const redirectUri = new URL('/api/pouriq/integrations/square/oauth/callback', request.url).toString()
    const token = await adapter.exchangeCodeForToken!(code, redirectUri)
    await upsertConnection(db, {
      trade_account_id: stateRow.trade_account_id,
      provider: 'square',
      external_account_id: token.externalAccountId,
      external_location_id: token.externalLocationId,
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      token_expires_at: token.expiresAt,
      scopes: token.scopes,
    })
    settingsUrl.searchParams.set('connected', 'square')
    return NextResponse.redirect(settingsUrl)
  } catch (e) {
    const detail = (e as Error)?.message ?? 'unknown'
    console.error('square-oauth-callback failed:', detail)
    Sentry.captureException(e, { tags: { route: 'square-oauth-callback' }, extra: { detail } })
    settingsUrl.searchParams.set('error', 'token_exchange_failed')
    settingsUrl.searchParams.set('detail', detail.slice(0, 300))
    return NextResponse.redirect(settingsUrl)
  }
}
