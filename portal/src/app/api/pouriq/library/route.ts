// GET /api/pouriq/library
// Returns the current tenant's library entries. Used by the import preview.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { listLibraryEntries } from '@/lib/pouriq/ingredient-library'

export const runtime = 'nodejs'

export async function GET() {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const entries = await listLibraryEntries(db, access.tradeAccountId)
  return NextResponse.json({ entries })
}
