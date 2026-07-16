'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MenuRollup, ProjectedCocktail } from '@/lib/pouriq/cost-impact'
import { RipplePreview } from '@/components/pouriq/RipplePreview'

// The headline demo moment. Copy supplied and byte-exact. The scan review
// and the result reuse the product's own invoice-review column labels and
// its RipplePreview, so no new copy is coined.
const PROMPT_TEXT = 'A Harrier delivery just landed. Scan the invoice and watch it ripple through your menu.'
const BUTTON_TEXT = 'Scan the invoice'

interface ScanLine {
  name: string
  quantity: number
  current_cost_p: number
  new_cost_p: number
  changed: boolean
}

interface ScanMeta {
  supplier_name: string
  invoice_number: string
  invoice_date: string
  lines: ScanLine[]
}

interface RippleResult {
  scan: ScanMeta | null
  projected: ProjectedCocktail[]
  rollups: MenuRollup[]
}

function money(p: number): string {
  return `£${(p / 100).toFixed(2)}`
}

function changePct(oldP: number, newP: number): number | null {
  if (oldP <= 0 || newP === oldP) return null
  return Math.round(((newP - oldP) / oldP) * 100)
}

// The scanned invoice, rendered read-only with the same columns the real
// invoice-review screen uses (Extracted / Qty / Current cost / New price /
// Change). This is the step the demo previously skipped — showing the lines
// coming off the document, with a current cost to compare against, is what
// makes the scan feel real before the ripple lands.
function DemoScanReview({ scan }: { scan: ScanMeta }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200">
        <p className="text-sm font-semibold text-slate-900">{scan.supplier_name}</p>
        <p className="text-xs text-slate-500">{scan.invoice_number} · {scan.invoice_date}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-500 text-xs uppercase tracking-widest">
              <th className="px-4 py-3">Extracted</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Current cost</th>
              <th className="px-4 py-3">New price</th>
              <th className="px-4 py-3">Change</th>
            </tr>
          </thead>
          <tbody>
            {scan.lines.map((l) => {
              const pct = changePct(l.current_cost_p, l.new_cost_p)
              return (
                <tr key={l.name} className={`border-t border-slate-200 ${l.changed ? 'bg-rose-50/50' : ''}`}>
                  <td className="px-4 py-3 text-slate-900">{l.name}</td>
                  <td className="px-4 py-3 text-slate-600 tabular-nums">{l.quantity}</td>
                  <td className="px-4 py-3 text-slate-600 tabular-nums">{money(l.current_cost_p)}</td>
                  <td className={`px-4 py-3 tabular-nums ${l.changed ? 'text-rose-700 font-medium' : 'text-slate-600'}`}>{money(l.new_cost_p)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {pct === null
                      ? <span className="text-slate-400">—</span>
                      : <span className="text-rose-600">+{pct}%</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function DemoScanRipple({ initiallyApplied = false }: { initiallyApplied?: boolean }) {
  const [result, setResult] = useState<RippleResult | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pouriq/demo/ripple', { method: 'POST' })
      if (res.ok) {
        const data = (await res.json()) as RippleResult
        setResult({ scan: data.scan ?? null, projected: data.projected, rollups: data.rollups })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Persisted in the overlay: re-show the ripple after a reload.
  useEffect(() => {
    if (initiallyApplied) void run()
  }, [initiallyApplied, run])

  return (
    <section className="mb-8 space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm text-emerald-900 mb-4">{PROMPT_TEXT}</p>
        {result === null && (
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {BUTTON_TEXT}
          </button>
        )}
      </div>
      {result !== null && (
        <>
          {result.scan && <DemoScanReview scan={result.scan} />}
          <RipplePreview projected={result.projected} rollups={result.rollups} />
        </>
      )}
    </section>
  )
}
