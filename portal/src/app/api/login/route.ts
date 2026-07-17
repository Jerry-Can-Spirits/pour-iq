// POST /api/login
// Body: { pin: string }
// Sets the jcs_trade_sid cookie on success.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  isAllowedOrigin,
  isRateLimited,
  incrementTradeFailedAttempts,
  clearTradeFailedAttempts,
  TRADE_MAX_ATTEMPTS,
  getTradeFailedAttemptsForPin,
  incrementTradeFailedAttemptsForPin,
  clearTradeFailedAttemptsForPin,
  TRADE_PIN_MAX_ATTEMPTS,
} from '@/lib/kv'
import { createTradeSession, setTradeSessionCookie } from '@/lib/trade-portal/session'
import {
  hashPin,
  isHashedPin,
  pinLookupKey,
  pinRateKey,
  verifyPin,
} from '@/lib/trade-portal/credentials'

export const runtime = 'nodejs'

const LOGIN_RATE_LIMIT = 10 // per hour per IP

interface LoginBody {
  pin?: string
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace
  const db = env.DB as D1Database

  const ip = (request.headers.get('CF-Connecting-IP') ?? request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()
  if (await isRateLimited(kv, 'trade-login', ip, LOGIN_RATE_LIMIT, 3600)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  let body: LoginBody
  try {
    body = (await request.json()) as LoginBody
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const pin = body.pin?.trim()
  // Minimum six digits: a deliberate floor for a shared bar tablet, set on
  // security grounds. Every issued PIN meets it; new accounts must mint at or
  // above it.
  if (!pin || pin.length < 6 || pin.length > 32) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })
  }

  // Rate-limit keys use a hash of the PIN so raw PINs never appear in
  // KV key names.
  const pinKey = await pinRateKey(pin)
  if ((await getTradeFailedAttemptsForPin(kv, pinKey)) >= TRADE_PIN_MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Too many failed attempts. Please try again later.' }, { status: 429 })
  }

  const failedAttempts = await incrementTradeFailedAttempts(kv, ip)
  if (failedAttempts > TRADE_MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Too many failed attempts. Please try again later.' }, { status: 429 })
  }

  const pepper = (env as { PIN_PEPPER?: string }).PIN_PEPPER

  let account: { id: string } | null = null
  if (pepper) {
    // Hashed path: SELECT by the deterministic lookup key, then verify
    // the stored PBKDF2 hash.
    const row = await db
      .prepare(`SELECT id, pin FROM trade_accounts WHERE pin_lookup = ?1 AND active = 1`)
      .bind(await pinLookupKey(pepper, pin))
      .first<{ id: string; pin: string }>()
    if (row && isHashedPin(row.pin) && (await verifyPin(pepper, pin, row.pin))) {
      account = { id: row.id }
    }
  }
  if (!account) {
    // Legacy plaintext row the sweep has not reached yet (or the pepper
    // is not set): equality is the verification, then upgrade in place
    // so this credential's plaintext era ends now.
    const row = await db
      .prepare(`SELECT id FROM trade_accounts WHERE pin = ?1 AND active = 1`)
      .bind(pin)
      .first<{ id: string }>()
    if (row) {
      account = { id: row.id }
      if (pepper) {
        await db
          .prepare(`UPDATE trade_accounts SET pin = ?1, pin_lookup = ?2 WHERE id = ?3`)
          .bind(await hashPin(pepper, pin), await pinLookupKey(pepper, pin), row.id)
          .run()
      }
    }
  }
  if (!account) {
    await incrementTradeFailedAttemptsForPin(kv, pinKey)
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
  }

  await clearTradeFailedAttempts(kv, ip)
  await clearTradeFailedAttemptsForPin(kv, pinKey)
  const sid = await createTradeSession(kv, account.id)
  await setTradeSessionCookie(sid)
  return NextResponse.json({ success: true })
}
