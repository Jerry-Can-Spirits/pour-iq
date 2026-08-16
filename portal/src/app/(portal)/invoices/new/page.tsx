import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { listLibraryEntries } from '@/lib/pouriq/ingredient-library'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { InvoiceScanFlow } from '@/components/pouriq/InvoiceScanFlow'

export const dynamic = 'force-dynamic'

export default async function ScanInvoicePage() {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const library = await listLibraryEntries(db, access.tradeAccountId)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <Link href="/library" className="text-sm text-slate-500 hover:text-slate-700">← Library</Link>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mt-3 mb-2">Scan an invoice</h1>
        <p className="text-slate-500 text-sm mb-10">
          Drop a supplier PDF. Pour IQ® extracts every line, matches against your library, and shows the combined GP impact before you commit.
        </p>
        <InvoiceScanFlow library={library} />
      </div>
    </main>
  )
}
