// POST /api/demo/reset — return the venue to base state by starting a
// fresh demo session, not by deleting the overlay in place.
//
// Why fresh-session rather than delete: Cloudflare KV propagates a PUT
// to edge reads immediately, but a DELETE leaves an already-cached read
// stale for up to the 60s cacheTtl. So a plain delete-then-reload can
// re-read the old overlay and the reset appears to do nothing (a
// prod-only effect miniflare's synchronous KV never shows). Minting a
// new session id means the reloaded page reads an empty overlay under a
// brand-new key — a guaranteed cache miss — so base state shows at once.
// The old overlay is deleted too; its stale cache is now orphaned and
// never read again.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { requireDemoSession } from '@/lib/pouriq/access'
import { clearDemoOverlay } from '@/lib/pouriq/demo/overlay'
import { createDemoSession, revokeDemoSession } from '@/lib/pouriq/demo/session'
import { DEMO_SESSION_COOKIE, DEMO_SESSION_TTL_SECONDS } from '@/lib/pouriq/demo/config'

export const runtime = 'nodejs'

export async function POST() {
  const sid = await requireDemoSession()
  if (!sid) return NextResponse.json({ error: 'No demo session' }, { status: 403 })

  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace

  await clearDemoOverlay(kv, sid)
  await revokeDemoSession(kv, sid)
  const newSid = await createDemoSession(kv)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(DEMO_SESSION_COOKIE, newSid, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: DEMO_SESSION_TTL_SECONDS,
  })
  return res
}
