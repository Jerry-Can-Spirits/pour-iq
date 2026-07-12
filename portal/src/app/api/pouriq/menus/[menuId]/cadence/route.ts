// PUT /api/pouriq/menus/[menuId]/cadence
// Switches the menu's volume reporting cadence between 'weekly' and 'monthly'.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isAllowedOrigin } from '@/lib/kv'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { getMenu } from '@/lib/pouriq/menus'
import { updateMenuCadence } from '@/lib/pouriq/volumes'
import type { VolumeCadence } from '@/lib/pouriq/types'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ menuId: string }>
}

interface PutBody {
  cadence: VolumeCadence
}

export async function PUT(request: Request, { params }: Params) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { menuId } = await params
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database

  const menu = await getMenu(db, menuId, access.tradeAccountId)
  if (!menu) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: PutBody
  try { body = await request.json() as PutBody } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (body.cadence !== 'weekly' && body.cadence !== 'monthly') {
    return NextResponse.json({ error: 'cadence must be weekly or monthly' }, { status: 400 })
  }

  await updateMenuCadence(db, menuId, access.tradeAccountId, body.cadence)
  return NextResponse.json({ cadence: body.cadence })
}
