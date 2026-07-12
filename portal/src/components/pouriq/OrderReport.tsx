'use client'

import { PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'

interface OrderRow {
  id: string
  name: string
  pack_size: number
  on_hand: number | null
  par: number | null
  order_qty: number
}

export function OrderReport({ rows }: { rows: OrderRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Nothing to order. Everything is at or above its par level.
      </p>
    )
  }

  return (
    <>
      <div className="no-print mb-6 flex justify-end">
        <button type="button" onClick={() => window.print()} className={PRIMARY_BUTTON}>
          Print
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-200">
            <th className="py-2 pr-4">Ingredient</th>
            <th className="py-2 pr-4 text-right">On hand</th>
            <th className="py-2 pr-4 text-right">Par</th>
            <th className="py-2 text-right">Order</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-slate-900">{r.name} <span className="text-slate-500">({r.pack_size}ml)</span></td>
              <td className="py-2 pr-4 text-right text-slate-600">{r.on_hand !== null ? r.on_hand.toFixed(1) : '—'}</td>
              <td className="py-2 pr-4 text-right text-slate-600">{r.par !== null ? r.par : '—'}</td>
              <td className="py-2 text-right text-slate-900 font-semibold">{r.order_qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
