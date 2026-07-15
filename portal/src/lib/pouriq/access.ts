import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getTradeSessionCookieValue, readTradeSession } from '@/lib/trade-portal/session'
import { getDemoSessionCookieValue, readDemoSession } from '@/lib/pouriq/demo/session'
import { DEMO_VENUE_ACCOUNT_ID } from '@/lib/pouriq/demo/config'
import type { PourIqLicence } from './types'

export type AccessRole = 'full' | 'demo'

export type AccessResult =
  | { kind: 'no-session' }
  | { kind: 'no-licence'; tradeAccountId: string }
  | { kind: 'ok'; tradeAccountId: string; licence: PourIqLicence; role: AccessRole }

export async function checkPourIqAccess(): Promise<AccessResult> {
  // Read cookies before touching the Cloudflare context: during static
  // prerender (no request) there is no context, and a request with no
  // session must return early without calling getCloudflareContext().
  const fullSid = await getTradeSessionCookieValue()
  const demoSid = await getDemoSessionCookieValue()
  if (!fullSid && !demoSid) return { kind: 'no-session' }

  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace
  const db = env.DB as D1Database

  // A full (PIN) session takes precedence. A demo session resolves ONLY
  // to the demo venue constant — never a value from the session — so it
  // can never point at another venue.
  let tradeAccountId: string | null = null
  let role: AccessRole = 'full'

  if (fullSid) {
    const session = await readTradeSession(kv, fullSid)
    if (session) tradeAccountId = session.tradeAccountId
  }

  if (!tradeAccountId && demoSid) {
    if (await readDemoSession(kv, demoSid)) {
      tradeAccountId = DEMO_VENUE_ACCOUNT_ID
      role = 'demo'
    }
  }

  if (!tradeAccountId) return { kind: 'no-session' }

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
    .bind(tradeAccountId)
    .first<PourIqLicence>()

  if (!licence) return { kind: 'no-licence', tradeAccountId }
  return { kind: 'ok', tradeAccountId, licence, role }
}

// Guard for the demo-only write endpoints. Returns the demo session id
// (for overlay keying) only when a valid demo session is present;
// otherwise null, and the caller returns 403. Never resolves for a full
// session — the demo endpoints are demo-exclusive.
export async function requireDemoSession(): Promise<string | null> {
  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace
  const demoSid = await getDemoSessionCookieValue()
  if (!demoSid) return null
  const session = await readDemoSession(kv, demoSid)
  return session ? demoSid : null
}
