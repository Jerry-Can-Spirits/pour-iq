import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import {
  getLibraryEntry,
  getLibraryEntryUsage,
  listLibraryEntries,
} from '@/lib/pouriq/ingredient-library'
import { loadImpactPayload } from '@/lib/pouriq/cost-impact-loader'
import { listServeUnits } from '@/lib/pouriq/serve-units'
import { listPreparedComponents } from '@/lib/pouriq/prepared'
import { listIngredientServes, listMenusForTradeAccount } from '@/lib/pouriq/menus'
import { listIngredientUses } from '@/lib/pouriq/ingredient-uses'
import { usableCostPerBaseUnitP } from '@/lib/pouriq/calculations'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { IngredientForm } from '@/components/pouriq/IngredientForm'
import { IngredientServes } from '@/components/pouriq/IngredientServes'
import { SECONDARY_BUTTON_SM } from '@/lib/pouriq/button-styles'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditLibraryEntryPage({ params }: Props) {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { id } = await params
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database

  const entry = await getLibraryEntry(db, id, access.tradeAccountId)
  if (!entry) notFound()

  const [usage, serveUnits, impactPayload, components, libraryEntries, ingredientServes, ingredientUses, menus] = await Promise.all([
    getLibraryEntryUsage(db, id),
    listServeUnits(db, id),
    loadImpactPayload(db, id, access.tradeAccountId),
    entry.is_prepared ? listPreparedComponents(db, id) : Promise.resolve([]),
    listLibraryEntries(db, access.tradeAccountId),
    listIngredientServes(db, access.tradeAccountId, id),
    listIngredientUses(db, id),
    listMenusForTradeAccount(db, access.tradeAccountId),
  ])
  if (!impactPayload) notFound()

  const costPerMlNetP = usableCostPerBaseUnitP(entry.price_p, entry.purchase_qty, entry.pack_size, entry.yield_pct)

  const byMenu = new Map<string, { menuName: string; cocktails: Array<{ id: string; name: string }> }>()
  for (const u of usage) {
    if (!byMenu.has(u.menu_id)) byMenu.set(u.menu_id, { menuName: u.menu_name, cocktails: [] })
    byMenu.get(u.menu_id)!.cocktails.push({ id: u.cocktail_id, name: u.cocktail_name })
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <Link href="/library" className="text-sm text-slate-500 hover:text-slate-700">← Library</Link>
        <div className="flex flex-wrap items-baseline justify-between gap-3 mt-3 mb-8">
          <h1 className="text-3xl font-bold text-slate-900">{entry.name}</h1>
          {usage.length > 0 && (
            <Link
              href={`/library/what-if?ingredient=${encodeURIComponent(entry.id)}`}
              className={SECONDARY_BUTTON_SM}
            >
              Test a cost change
            </Link>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 mb-8">
          <IngredientForm entry={entry} usageCount={usage.length} impactPayload={impactPayload} serveUnits={serveUnits} components={components} libraryEntries={libraryEntries} uses={ingredientUses} />
        </div>

        <IngredientServes
          libraryId={entry.id}
          ingredientName={entry.name}
          ingredientType={entry.ingredient_type}
          costPerMlNetP={costPerMlNetP}
          serves={ingredientServes}
          menus={menus.map((m) => ({ id: m.id, name: m.name }))}
        />

        {byMenu.size > 0 && (
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Used in</h2>
            <div className="space-y-4">
              {Array.from(byMenu.entries()).map(([menuId, info]) => (
                <div key={menuId}>
                  <Link href={`/${menuId}`} className="text-sm font-medium text-emerald-700 hover:text-emerald-600 underline">
                    {info.menuName}
                  </Link>
                  <ul className="mt-1 text-sm text-slate-600 list-inside list-disc">
                    {info.cocktails.map((c) => (
                      <li key={c.id}>
                        <Link href={`/${menuId}/edit?cocktail=${c.id}`} className="hover:text-slate-900 underline">
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
