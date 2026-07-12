import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getTradeSessionCookieValue, readTradeSession } from '@/lib/trade-portal/session'
import type { PourIqLicence } from './types'

export type AccessResult =
  | { kind: 'no-session' }
  | { kind: 'no-licence', tradeAccountId: string }
  | { kind: 'ok', tradeAccountId: string, licence: PourIqLicence }

export async function checkPourIqAccess(): Promise<AccessResult> {
  const sid = await getTradeSessionCookieValue()
  if (!sid) return { kind: 'no-session' }

  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace
  const db = env.DB as D1Database

  const session = await readTradeSession(kv, sid)
  if (!session) return { kind: 'no-session' }

  const licence = await db
    .prepare(`
      SELECT id, trade_account_id, licence_type, valid_from, valid_until, price_paid_p
      FROM pouriq_subscriptions
      WHERE trade_account_id = ?1
        AND datetime(valid_from) <= datetime('now')
        AND datetime(valid_until) >= datetime('now')
      ORDER BY valid_until DESC
      LIMIT 1
    `)
    .bind(session.tradeAccountId)
    .first<PourIqLicence>()

  if (!licence) return { kind: 'no-licence', tradeAccountId: session.tradeAccountId }
  return { kind: 'ok', tradeAccountId: session.tradeAccountId, licence }
}
