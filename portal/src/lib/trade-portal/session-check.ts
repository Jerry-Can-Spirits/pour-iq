import { redirect } from 'next/navigation'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getTradeSessionCookieValue, readTradeSession } from './session'

export interface TradeSessionContext {
  tradeAccountId: string
  venue_name: string
  tier: string
}

/**
 * Asserts that the request has a valid trade portal session.
 * Returns the trade account context. Redirects to /login on failure.
 *
 * Use in server components and server actions for any session-gated route
 * that does not need a product-specific licence check.
 */
export async function requireTradeSession(): Promise<TradeSessionContext> {
  const sid = await getTradeSessionCookieValue()
  if (!sid) redirect('/login')

  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace
  const db = env.DB as D1Database

  const session = await readTradeSession(kv, sid)
  if (!session) redirect('/login')

  const account = await db
    .prepare(`SELECT venue_name, tier FROM trade_accounts WHERE id = ?1 AND active = 1`)
    .bind(session.tradeAccountId)
    .first<{ venue_name: string; tier: string }>()

  if (!account) redirect('/login')

  return {
    tradeAccountId: session.tradeAccountId,
    venue_name: account.venue_name,
    tier: account.tier,
  }
}
