// Generic OAuth callback for accounting providers. QuickBooks appends
// realmId (the company id) to the redirect; Xero resolves its org via the
// connections endpoint inside the adapter.

import { NextResponse } from 'next/server'
import * as Sentry from '@/lib/sentry'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { consumeAccountingOAuthState, upsertAccountingConnection } from '@/lib/pouriq/accounting/connections'
import { getAccountingAdapter } from '@/lib/pouriq/accounting/providers'
import { isKnownAccountingProvider } from '@/lib/pouriq/accounting/types'

export const runtime = 'nodejs'

interface Params { params: Promise<{ provider: string }> }

export async function GET(request: Request, { params }: Params) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const realmId = url.searchParams.get('realmId')

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
  if (!isKnownAccountingProvider(provider)) {
    settingsUrl.searchParams.set('error', 'missing_params')
    return NextResponse.redirect(settingsUrl)
  }

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const stateRow = await consumeAccountingOAuthState(db, state)
  if (!stateRow || stateRow.provider !== provider || stateRow.trade_account_id !== access.tradeAccountId) {
    settingsUrl.searchParams.set('error', 'invalid_state')
    return NextResponse.redirect(settingsUrl)
  }

  const adapter = getAccountingAdapter(provider, env)
  if (!adapter) {
    settingsUrl.searchParams.set('error', 'missing_params')
    return NextResponse.redirect(settingsUrl)
  }

  try {
    const redirectUri = new URL(`/api/pouriq/integrations/accounting/${provider}/oauth/callback`, request.url).toString()
    const result = await adapter.exchangeCodeForToken(code, redirectUri, realmId)
    await upsertAccountingConnection(db, {
      trade_account_id: stateRow.trade_account_id,
      provider,
      external_account_id: result.externalAccountId,
      external_account_name: result.externalAccountName,
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      token_expires_at: result.expiresAt,
    })
    settingsUrl.searchParams.set('connected', provider)
    return NextResponse.redirect(settingsUrl)
  } catch (e) {
    const detail = (e as Error)?.message ?? 'unknown'
    console.error(`${provider}-accounting-oauth-callback failed:`, detail)
    Sentry.captureException(e, { tags: { route: 'accounting-oauth-callback', provider }, extra: { detail } })
    settingsUrl.searchParams.set('error', 'token_exchange_failed')
    settingsUrl.searchParams.set('detail', detail.slice(0, 300))
    return NextResponse.redirect(settingsUrl)
  }
}
