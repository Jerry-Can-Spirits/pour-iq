// GET /api/pouriq/library/by-barcode?code=XXXXX
// Returns:
//   - entry: the caller's tenant library entry for this barcode (or null)
//   - catalogue: cross-tenant product attributes (name, type, size) when
//     the code is in the shared catalogue, so a 'no tenant match but we
//     know the product' scan can prefill the inline create form.
// Cost is never returned via the catalogue — every tenant enters their
// own.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { findLibraryEntryByBarcode } from '@/lib/pouriq/ingredient-library'
import { findCatalogueEntry } from '@/lib/pouriq/barcode-catalogue'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')?.trim()
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const [entry, catalogue] = await Promise.all([
    findLibraryEntryByBarcode(db, access.tradeAccountId, code),
    findCatalogueEntry(db, code),
  ])

  return NextResponse.json({
    entry,
    catalogue: catalogue
      ? {
          name: catalogue.name,
          ingredient_type: catalogue.ingredient_type,
          pack_size_ml: catalogue.pack_size_ml,
          verified: catalogue.verified === 1,
        }
      : null,
  })
}
