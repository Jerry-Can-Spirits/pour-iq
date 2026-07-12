import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { getMenu, listCocktailsForMenu } from '@/lib/pouriq/menus'
import { ensureSeededSections, listSectionsForMenu } from '@/lib/pouriq/menu-sections'
import { MenuBuilder } from '@/components/pouriq/MenuBuilder'
import { cocktailAllergenInfo } from '@/lib/pouriq/allergens'
import { cocktailAbv } from '@/lib/pouriq/abv'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ menuId: string }>
}

export default async function MenuBuilderPage({ params }: Props) {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { menuId } = await params
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database

  const menu = await getMenu(db, menuId, access.tradeAccountId)
  if (!menu) notFound()

  await ensureSeededSections(db, menuId)
  const sections = await listSectionsForMenu(db, menuId)
  const cocktails = await listCocktailsForMenu(db, menuId)
  const drinks = cocktails.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    sale_price_p: c.sale_price_p,
    section_id: c.section_id,
    item_type: c.item_type,
    position: c.position,
    photo_r2_key: c.photo_r2_key,
    updated_at: c.updated_at,
  }))
  const allergenInfoById = Object.fromEntries(
    cocktails.map((c) => [c.id, cocktailAllergenInfo(c.ingredients)]),
  )
  const abvById = Object.fromEntries(
    cocktails.map((c) => [c.id, cocktailAbv(c.ingredients)]),
  )

  return (
    <main className="min-h-screen print-region">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <Link href={`/${menuId}`} className="text-sm text-slate-500 hover:text-slate-700 no-print">← Back to menu</Link>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mt-3 mb-2 no-print">Menu builder</h1>
        <p className="text-slate-500 text-sm mb-8 no-print">
          A branded, customer-facing version of this menu. Adjust it, then save it as a PDF to print or send.
        </p>
        <MenuBuilder
          menuId={menuId}
          menuName={menu.name}
          sections={sections}
          drinks={drinks}
          theme={menu.theme}
          logoR2Key={menu.logo_r2_key}
          logoAlign={menu.logo_align}
          menuUpdatedAt={menu.updated_at}
          allergenInfoById={allergenInfoById}
          abvById={abvById}
        />
      </div>
    </main>
  )
}
