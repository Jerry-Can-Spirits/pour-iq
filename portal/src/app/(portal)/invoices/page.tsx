import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { listInvoicesForTenant } from '@/lib/pouriq/invoices'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { InvoiceListTabs } from '@/components/pouriq/InvoiceListTabs'
import { PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'
import { listAccountingConnections, isConnectionReady } from '@/lib/pouriq/accounting/connections'
import { getPushMapForInvoices, PUSH_CLAIM_SENTINEL } from '@/lib/pouriq/accounting/pushes'

export const dynamic = 'force-dynamic'

export default async function InvoicesListPage() {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const invoices = await listInvoicesForTenant(db, access.tradeAccountId)

  const accountingConnections = await listAccountingConnections(db, access.tradeAccountId)
  const hasAccounting = accountingConnections.some(isConnectionReady)
  const pushMap = hasAccounting ? await getPushMapForInvoices(db, invoices.map((i) => i.id)) : new Map()
  const pushBadges = Object.fromEntries(
    [...pushMap.entries()]
      .filter(([, p]) => !(p.status === 'failed' && p.error === PUSH_CLAIM_SENTINEL))
      .map(([id, p]) => [id, p.status]),
  ) as Record<string, 'pushed' | 'failed'>

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <Link href="/library" className="text-sm text-slate-500 hover:text-slate-700">← Library</Link>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mt-3">Recent invoices</h1>
            <p className="text-slate-500 text-sm mt-2">{invoices.length} invoice{invoices.length === 1 ? '' : 's'} scanned</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/price-changes" className="text-sm text-slate-600 hover:text-slate-900">Price changes</Link>
            <Link href="/invoices/new" className={PRIMARY_BUTTON}>Scan an invoice</Link>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="bg-white rounded-xl p-10 border border-slate-200 text-center text-slate-600">
            No invoices yet. Drop your first one to populate the library.
          </div>
        ) : (
          <InvoiceListTabs invoices={invoices} pushBadges={hasAccounting ? pushBadges : undefined} />
        )}
      </div>
    </main>
  )
}
