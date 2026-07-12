import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { listLibraryEntries, getLibraryUsageCounts } from '@/lib/pouriq/ingredient-library'
import { loadStockLevels } from '@/lib/pouriq/stock-loader'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { IngredientList } from '@/components/pouriq/IngredientList'
import { CostUpdateToastReader } from '@/components/pouriq/CostUpdateToastReader'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/lib/pouriq/button-styles'

export const dynamic = 'force-dynamic'

export default async function LibraryPage() {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const [entries, usageCounts, stockRows] = await Promise.all([
    listLibraryEntries(db, access.tradeAccountId),
    getLibraryUsageCounts(db, access.tradeAccountId),
    loadStockLevels(db, access.tradeAccountId),
  ])
  const stockById: Record<string, { needs_reorder: boolean; reorder_qty: number; on_hand_bottles: number | null }> = {}
  for (const r of stockRows) {
    stockById[r.library_ingredient_id] = { needs_reorder: r.needs_reorder, reorder_qty: r.reorder_qty, on_hand_bottles: r.on_hand_bottles }
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <div className="flex items-baseline justify-between mb-8 flex-wrap gap-3">
          <div>
            <Link href="/menus" className="text-sm text-slate-500 hover:text-slate-700">← All menus</Link>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mt-3">Ingredient library</h1>
            <p className="text-slate-500 text-sm mt-2">{entries.length} ingredient{entries.length === 1 ? '' : 's'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/invoices" className={SECONDARY_BUTTON}>Recent invoices</Link>
            <Link href="/invoices/new" className={SECONDARY_BUTTON}>Scan an invoice</Link>
            <Link href="/library/what-if" className={SECONDARY_BUTTON}>Run a what-if</Link>
            <Link href="/library/new" className={PRIMARY_BUTTON}>Add ingredient</Link>
          </div>
        </div>

        <IngredientList entries={entries} usageCounts={usageCounts} stockById={stockById} />
      </div>
      <CostUpdateToastReader />
    </main>
  )
}
