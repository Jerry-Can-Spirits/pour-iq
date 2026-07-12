'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { InvoiceRow } from '@/lib/pouriq/invoices'
import { invoiceStatus } from '@/lib/pouriq/invoice-status'

type Tab = 'all' | 'applied' | 'attention'

interface Props {
  invoices: InvoiceRow[]
  pushBadges?: Record<string, 'pushed' | 'failed'>
}

function formatMoney(p: number | null): string {
  if (p === null) return '—'
  return `£${(p / 100).toFixed(2)}`
}

export function InvoiceListTabs({ invoices, pushBadges }: Props) {
  const [tab, setTab] = useState<Tab>('all')

  const appliedCount = invoices.filter((inv) => invoiceStatus(inv) === 'applied').length
  const attentionCount = invoices.filter((inv) => invoiceStatus(inv) === 'attention').length

  const visible = tab === 'all' ? invoices : invoices.filter((inv) => invoiceStatus(inv) === tab)

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t
        ? 'bg-white border border-slate-200 text-slate-900 shadow-sm'
        : 'text-slate-500 hover:text-slate-700'
    }`

  return (
    <div>
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl w-fit">
        <button type="button" className={tabClass('all')} onClick={() => setTab('all')}>
          All ({invoices.length})
        </button>
        <button type="button" className={tabClass('applied')} onClick={() => setTab('applied')}>
          Fully applied ({appliedCount})
        </button>
        <button type="button" className={tabClass('attention')} onClick={() => setTab('attention')}>
          Needs attention ({attentionCount})
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-slate-500">No invoices in this view.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-500 text-xs uppercase tracking-widest">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Net total</th>
                  <th className="px-4 py-3">Lines applied</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((inv) => {
                  const status = invoiceStatus(inv)
                  return (
                    <tr key={inv.id} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/invoices/${inv.id}`} className="text-emerald-700 hover:text-emerald-600 underline">
                          {inv.invoice_date ?? inv.created_at.slice(0, 10)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-900">{inv.supplier_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{inv.invoice_number ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{formatMoney(inv.net_total_p)}</td>
                      <td className="px-4 py-3 text-slate-600">{inv.applied_line_count} / {inv.line_count}</td>
                      <td className="px-4 py-3">
                        {status === 'applied' ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-600">applied</span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-500">needs attention</span>
                        )}
                        {pushBadges?.[inv.id] === 'pushed' && (
                          <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-500">in accounts</span>
                        )}
                        {pushBadges?.[inv.id] === 'failed' && (
                          <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-500">push failed</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
