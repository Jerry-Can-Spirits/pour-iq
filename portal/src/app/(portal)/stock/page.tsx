import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { loadStockLevels } from '@/lib/pouriq/stock-loader'
import { StockManager } from '@/components/pouriq/StockManager'

export const dynamic = 'force-dynamic'

export default async function StockPage() {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const rows = await loadStockLevels(db, access.tradeAccountId)

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <Link href="/menus" className="text-sm text-slate-500 hover:text-slate-700">← All menus</Link>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mt-3 mb-2">Stock</h1>
        <p className="text-slate-500 text-sm mb-10">
          An estimate of what you have on hand, from your last count plus deliveries minus what the till says you have poured.
        </p>
        <StockManager rows={rows} />
      </div>
    </main>
  )
}
