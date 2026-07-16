// POST /api/demo/reset — drop the session's write overlay and return the
// venue to base state. The session itself survives; only the overlay
// cookie (price toggles, applied ripple) is cleared. On the write
// allowlist. Clearing a cookie is read-your-writes instant, so the
// reloaded page shows base state at once.

import { NextResponse } from 'next/server'
import { requireDemoSession } from '@/lib/pouriq/access'
import { DEMO_OVERLAY_COOKIE } from '@/lib/pouriq/demo/overlay'

export const runtime = 'nodejs'

export async function POST() {
  const sid = await requireDemoSession()
  if (!sid) return NextResponse.json({ error: 'No demo session' }, { status: 403 })

  const res = NextResponse.json({ ok: true })
  res.cookies.delete(DEMO_OVERLAY_COOKIE)
  return res
}
