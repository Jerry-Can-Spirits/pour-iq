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
  if (!pin || pin.length < 4 || pin.length > 32) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })
  }

  if ((await getTradeFailedAttemptsForPin(kv, pin)) >= TRADE_PIN_MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Too many failed attempts. Please try again later.' }, { status: 429 })
  }

  const failedAttempts = await incrementTradeFailedAttempts(kv, ip)
  if (failedAttempts > TRADE_MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Too many failed attempts. Please try again later.' }, { status: 429 })
  }

  const account = await db
    .prepare(`SELECT id FROM trade_accounts WHERE pin = ?1 AND active = 1`)
    .bind(pin)
    .first<{ id: string }>()
  if (!account) {
    await incrementTradeFailedAttemptsForPin(kv, pin)
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
  }

  await clearTradeFailedAttempts(kv, ip)
  await clearTradeFailedAttemptsForPin(kv, pin)
  const sid = await createTradeSession(kv, account.id)
  await setTradeSessionCookie(sid)
  return NextResponse.json({ success: true })
}
