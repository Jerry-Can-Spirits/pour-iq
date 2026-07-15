// POST /api/demo/reset — drop the session's write overlay and return the
// venue to base state. The session itself survives; only the overlay
// (price toggles, applied ripple) is cleared. On the write allowlist.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { requireDemoSession } from '@/lib/pouriq/access'
import { clearDemoOverlay } from '@/lib/pouriq/demo/overlay'

export const runtime = 'nodejs'

export async function POST() {
  const sid = await requireDemoSession()
  if (!sid) return NextResponse.json({ error: 'No demo session' }, { status: 403 })

  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace
  await clearDemoOverlay(kv, sid)
  return NextResponse.json({ ok: true })
}
