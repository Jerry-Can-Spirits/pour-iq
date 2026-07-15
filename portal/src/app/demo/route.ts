// GET /demo — mint an anonymous demo session and drop the visitor into
// The Signal Box. No PIN, no account. Rate-limited per IP. Clears any
// full (PIN) session cookie so demo restrictions can never straddle a
// real login.

import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isRateLimited } from '@/lib/kv'
import { createDemoSession } from '@/lib/pouriq/demo/session'
import { TRADE_SESSION_COOKIE } from '@/lib/trade-portal/session'
import {
  DEMO_SESSION_COOKIE,
  DEMO_SESSION_TTL_SECONDS,
  DEMO_MINT_RATE_LIMIT,
} from '@/lib/pouriq/demo/config'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace

  const ip = (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for') ??
    'unknown'
  )
    .split(',')[0]
    .trim()
  if (await isRateLimited(kv, 'demo-mint', ip, DEMO_MINT_RATE_LIMIT, 3600)) {
    return new NextResponse('Too many demo sessions from this address. Please try again shortly.', {
      status: 429,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  const sid = await createDemoSession(kv)
  const res = NextResponse.redirect(new URL('/', request.url))
  res.cookies.set(DEMO_SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: DEMO_SESSION_TTL_SECONDS,
  })
  // A demo visitor is anonymous — never also a logged-in venue.
  res.cookies.delete(TRADE_SESSION_COOKIE)
  return res
}
