import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { getMenu } from '@/lib/pouriq/menus'
import { MenuCopyExport } from '@/components/pouriq/MenuCopyExport'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ menuId: string }>
}

interface DrinkRow {
  name: string
  description: string | null
  sale_price_p: number | null
}

export default async function MenuCopyPage({ params }: Params) {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { menuId } = await params
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database

  const menu = await getMenu(db, menuId, access.tradeAccountId)
  if (!menu) redirect('/')

  const drinks = (
    await db
      .prepare(`SELECT name, description, sale_price_p FROM pouriq_cocktails WHERE menu_id = ?1 ORDER BY name COLLATE NOCASE ASC`)
      .bind(menuId)
      .all<DrinkRow>()
  ).results ?? []

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <Link href={`/${menuId}`} className="text-sm text-slate-500 hover:text-slate-700">← {menu.name}</Link>
        <div className="inline-block px-4 py-2 bg-slate-100 rounded-full border border-slate-200 mt-3 mb-6">
          <span className="text-slate-500 text-sm font-semibold uppercase tracking-widest">Pour IQ®</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Menu copy</h1>
        <p className="text-slate-600 text-base leading-relaxed mb-8">
          Every drink on this menu with its saved description. Copy to clipboard or download to hand to your designer.
        </p>
        {drinks.length === 0 ? (
          <p className="text-slate-600">No drinks on this menu yet.</p>
        ) : (
          <MenuCopyExport menuName={menu.name} drinks={drinks} />
        )}
      </div>
    </main>
  )
}
