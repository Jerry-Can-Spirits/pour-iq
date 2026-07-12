import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { listServes } from '@/lib/pouriq/menus'
import { listLibraryEntries } from '@/lib/pouriq/ingredient-library'
import { listServeUnitsForTenant } from '@/lib/pouriq/serve-units'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { ServeManager } from '@/components/pouriq/ServeManager'
import type { ServeUnitRow } from '@/lib/pouriq/types'

export const dynamic = 'force-dynamic'

export default async function ServesPage() {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const [serves, libraryEntries, serveUnitsMap] = await Promise.all([
    listServes(db, access.tradeAccountId),
    listLibraryEntries(db, access.tradeAccountId),
    listServeUnitsForTenant(db, access.tradeAccountId),
  ])

  // Serialise Map → plain object for client component prop boundary.
  const serveUnits: Record<string, ServeUnitRow[]> = {}
  for (const [id, rows] of serveUnitsMap) serveUnits[id] = rows

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <Link href="/menus" className="text-sm text-slate-500 hover:text-slate-700">← All menus</Link>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mt-3 mb-2">Serves</h1>
        <p className="text-slate-500 text-sm mb-10">
          Serves give non-cocktail POS sales like a vodka and coke or a house single a light pour spec, so those sales still deplete stock.
        </p>
        <ServeManager serves={serves} libraryEntries={libraryEntries} serveUnits={serveUnits} />
      </div>
    </main>
  )
}
