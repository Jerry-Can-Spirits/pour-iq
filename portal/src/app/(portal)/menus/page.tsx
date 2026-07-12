import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { listMenusForTradeAccount } from '@/lib/pouriq/menus'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { MenuListCard } from '@/components/pouriq/MenuListCard'
import { PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'

export const dynamic = 'force-dynamic'

export default async function MenusPage() {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const menus = await listMenusForTradeAccount(db, access.tradeAccountId)

  return (
    <main className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Your menus</h1>
          <div className="flex items-center gap-4">
            <Link href="/compare" className="text-sm text-emerald-700 hover:text-emerald-600 underline">Compare menus →</Link>
            <Link href="/new" className={PRIMARY_BUTTON}>New menu</Link>
          </div>
        </div>
        {menus.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-slate-200 text-center">
            <p className="text-slate-600 mb-2">No menus yet.</p>
            <p className="text-slate-500 text-sm mb-4">Create your first to begin analysis.</p>
            <Link href="/new" className={PRIMARY_BUTTON}>New menu</Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {menus.map((m) => <MenuListCard key={m.id} menu={m} />)}
          </div>
        )}
      </div>
    </main>
  )
}
