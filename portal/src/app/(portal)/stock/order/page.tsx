import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { loadStockLevels } from '@/lib/pouriq/stock-loader'
import { OrderReport } from '@/components/pouriq/OrderReport'

export const dynamic = 'force-dynamic'

export default async function OrderReportPage() {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const rows = await loadStockLevels(db, access.tradeAccountId)
  const toOrder = rows
    .filter((r) => r.needs_reorder)
    .sort((a, b) => a.library_name.localeCompare(b.library_name))
    .map((r) => ({ id: r.library_ingredient_id, name: r.library_name, pack_size: r.pack_size, on_hand: r.on_hand_bottles, par: r.par_bottles, order_qty: r.reorder_qty }))

  return (
    <main className="min-h-screen print-region">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <Link href="/stock" className="text-sm text-slate-500 hover:text-slate-700 no-print">← Stock</Link>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mt-3 mb-2">Order report</h1>
        <p className="text-slate-500 text-sm mb-8 no-print">Everything below its par level, with how much to order.</p>
        <OrderReport rows={toOrder} />
      </div>
    </main>
  )
}
