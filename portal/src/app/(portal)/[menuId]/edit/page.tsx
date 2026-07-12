import { redirect, notFound } from 'next/navigation'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import Link from 'next/link'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { getMenu, getCocktail } from '@/lib/pouriq/menus'
import { listLibraryEntries } from '@/lib/pouriq/ingredient-library'
import { listServeUnitsForTenant } from '@/lib/pouriq/serve-units'
import { listUsesForTenant } from '@/lib/pouriq/ingredient-uses'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { CocktailForm } from '@/components/pouriq/CocktailForm'
import type { ServeUnitRow, IngredientUseRow } from '@/lib/pouriq/types'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ menuId: string }>
  searchParams: Promise<{ cocktail?: string }>
}

export default async function EditMenuPage({ params, searchParams }: Props) {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { menuId } = await params
  const { cocktail: cocktailId } = await searchParams

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database

  const [menu, cocktail, libraryEntries, serveUnitsMap, ingredientUsesMap] = await Promise.all([
    getMenu(db, menuId, access.tradeAccountId),
    cocktailId ? getCocktail(db, cocktailId, access.tradeAccountId) : Promise.resolve(null),
    listLibraryEntries(db, access.tradeAccountId),
    listServeUnitsForTenant(db, access.tradeAccountId),
    listUsesForTenant(db, access.tradeAccountId),
  ])

  if (!menu) notFound()
  if (cocktailId && (!cocktail || cocktail.menu_id !== menuId)) notFound()

  // Serialise Maps → plain objects for client component prop boundary.
  const serveUnits: Record<string, ServeUnitRow[]> = {}
  for (const [id, rows] of serveUnitsMap) serveUnits[id] = rows
  const ingredientUses: Record<string, IngredientUseRow[]> = {}
  for (const [id, rows] of ingredientUsesMap) ingredientUses[id] = rows

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <Link href={`/${menuId}`} className="text-sm text-slate-500 hover:text-slate-700">← Back to {menu.name}</Link>
        <h1 className="text-3xl font-bold text-slate-900 mt-4 mb-8">
          {cocktail ? `Edit ${cocktail.name}` : 'Add a drink'}
        </h1>
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <CocktailForm menuId={menuId} cocktail={cocktail} libraryEntries={libraryEntries} serveUnits={serveUnits} ingredientUses={ingredientUses} />
        </div>
      </div>
    </main>
  )
}
