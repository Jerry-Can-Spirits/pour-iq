import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { listUnmatched, listMappableCocktails, listMappableServes } from '@/lib/pouriq/pos/item-map'
import { listLibraryEntries } from '@/lib/pouriq/ingredient-library'
import { listServeUnitsForTenant } from '@/lib/pouriq/serve-units'
import { UnmatchedReview } from '@/components/pouriq/UnmatchedReview'
import type { ServeUnitRow } from '@/lib/pouriq/types'

export const dynamic = 'force-dynamic'

export default async function UnmatchedPage() {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const [items, cocktails, serves, libraryEntries, serveUnitsMap] = await Promise.all([
    listUnmatched(db, access.tradeAccountId),
    listMappableCocktails(db, access.tradeAccountId),
    listMappableServes(db, access.tradeAccountId),
    listLibraryEntries(db, access.tradeAccountId),
    listServeUnitsForTenant(db, access.tradeAccountId),
  ])

  const serveUnits: Record<string, ServeUnitRow[]> = {}
  for (const [id, rows] of serveUnitsMap) serveUnits[id] = rows

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <Link href="/settings/integrations" className="text-sm text-slate-500 hover:text-slate-700">← Integrations</Link>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mt-3 mb-2">Unmatched sales</h1>
        <p className="text-slate-500 text-sm mb-10">
          Till items your POS sent that did not match a cocktail. Map each one so its sales count, or mark it as not a cocktail.
        </p>
        <UnmatchedReview items={items} cocktails={cocktails} serves={serves} libraryEntries={libraryEntries} serveUnits={serveUnits} />
      </div>
    </main>
  )
}
