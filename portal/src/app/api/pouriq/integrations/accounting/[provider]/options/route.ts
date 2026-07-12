// Live-fetched choices for the finish-setup panel: Xero orgs (when the
// login holds several), expense accounts, and VAT/tax treatments.

import { NextResponse } from 'next/server'
import * as Sentry from '@/lib/sentry'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { getAccountingConnection, updateAccountingTokens } from '@/lib/pouriq/accounting/connections'
import { getAccountingAdapter } from '@/lib/pouriq/accounting/providers'
import { isKnownAccountingProvider } from '@/lib/pouriq/accounting/types'
import { needsTokenRefresh } from '@/lib/pouriq/accounting/bill-builder'

export const runtime = 'nodejs'

interface Params { params: Promise<{ provider: string }> }

export async function GET(request: Request, { params }: Params) {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { provider } = await params
  if (!isKnownAccountingProvider(provider)) return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const adapter = getAccountingAdapter(provider, env)
  let connection = await getAccountingConnection(db, access.tradeAccountId, provider)
  if (!adapter || !connection) return NextResponse.json({ error: 'Not connected' }, { status: 404 })

  try {
    if (needsTokenRefresh(connection.token_expires_at, Date.now())) {
      if (!connection.refresh_token) throw new Error('No refresh token; reconnect required')
      const tokens = await adapter.refreshAccessToken(connection.refresh_token)
      await updateAccountingTokens(db, connection.id, tokens)
      connection = {
        ...connection,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken ?? connection.refresh_token,
        token_expires_at: tokens.expiresAt,
      }
    }

    const tenantParam = new URL(request.url).searchParams.get('tenant')
    const effectiveTenant = tenantParam ?? connection.external_account_id
    const needsTenant = effectiveTenant === ''

    const tenants = provider === 'xero' ? await adapter.listTenants(connection.access_token) : []
    if (needsTenant) {
      return NextResponse.json({ needsTenant: true, tenants, accounts: [], taxOptions: [] })
    }

    const effective = { ...connection, external_account_id: effectiveTenant }
    const [accounts, taxOptions] = await Promise.all([
      adapter.listExpenseAccounts(effective),
      adapter.listTaxOptions(effective),
    ])
    return NextResponse.json({ needsTenant: false, tenants, accounts, taxOptions })
  } catch (e) {
    Sentry.captureException(e, { tags: { route: 'accounting-options', provider } })
    return NextResponse.json({ error: 'Could not load choices from the provider. Try reconnecting.' }, { status: 502 })
  }
}
