// GET /api/pouriq/serve-units
// Returns all serve units for the current tenant, keyed by library ingredient id.
// Used by the import preview (client component) to populate the ServeUnitPicker.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { listServeUnitsForTenant } from '@/lib/pouriq/serve-units'
import type { ServeUnitRow } from '@/lib/pouriq/types'

export const runtime = 'nodejs'

export async function GET() {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const map = await listServeUnitsForTenant(db, access.tradeAccountId)
  const serveUnits: Record<string, ServeUnitRow[]> = {}
  for (const [id, rows] of map) serveUnits[id] = rows
  return NextResponse.json({ serveUnits })
}
