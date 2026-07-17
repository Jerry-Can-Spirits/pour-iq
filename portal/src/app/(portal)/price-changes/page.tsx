import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { listCostChanges } from '@/lib/pouriq/invoices'
import { pctChange } from '@/lib/pouriq/cost-changes'
import { LicenceGate } from '@/components/pouriq/LicenceGate'

export const dynamic = 'force-dynamic'

function fmt(p: number | null): string {
  if (p === null) return '—'
  return `£${(p / 100).toFixed(2)}`
}

function ChangeCell({ oldP, newP }: { oldP: number | null; newP: number }) {
  const pct = pctChange(oldP, newP)
  if (pct === null) return <span className="text-slate-400">—</span>
  if (pct > 0) return <span className="text-rose-600 tabular-nums">+{pct}%</span>
  if (pct < 0) return <span className="text-emerald-600 tabular-nums">{pct}%</span>
  return <span className="text-slate-500 tabular-nums">0%</span>
}

export default async function PriceChangesPage() {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const changes = await listCostChanges(db, access.tradeAccountId)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <div className="mb-8">
          <Link href="/invoices" className="text-sm text-slate-500 hover:text-slate-700">← Invoices</Link>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mt-3">Price changes</h1>
          <p className="text-slate-500 text-sm mt-2">Recent cost changes from invoices and manual updates.</p>
        </div>

        {changes.length === 0 ? (
          <div className="bg-white rounded-xl p-10 border border-slate-200 text-center text-slate-600">
            No price changes yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-500 text-xs uppercase tracking-widest">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Ingredient</th>
                    <th className="px-4 py-3">Old</th>
                    <th className="px-4 py-3">New</th>
                    <th className="px-4 py-3">Change</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((c) => (
                    <tr key={c.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 text-slate-600 tabular-nums">{c.changed_at.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-slate-900">{c.ingredient_name}</td>
                      <td className="px-4 py-3 text-slate-600 tabular-nums">{fmt(c.old_cost_p)}</td>
                      <td className="px-4 py-3 text-slate-700 tabular-nums">{fmt(c.new_cost_p)}</td>
                      <td className="px-4 py-3"><ChangeCell oldP={c.old_cost_p} newP={c.new_cost_p} /></td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{c.source}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.invoice_id ? (
                          <Link href={`/invoices/${c.invoice_id}`} className="text-emerald-700 hover:text-emerald-600 underline">
                            {c.supplier_name ?? 'View invoice'}
                          </Link>
                        ) : (
                          c.supplier_name ?? '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
