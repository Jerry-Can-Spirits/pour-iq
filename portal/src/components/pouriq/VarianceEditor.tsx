'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { VARIANCE_REASONS } from '@/lib/pouriq/types'
import { summariseVarianceByReason } from '@/lib/pouriq/variance'
import { statusText } from '@/lib/pouriq/ui'
import { SECONDARY_BUTTON_SM } from '@/lib/pouriq/button-styles'

interface RollingTrendPoint {
  counted_at: string
  variance_cost_p: number | null
  reason: string | null
}

interface RollingVarianceRow {
  library_ingredient_id: string
  library_name: string
  pack_size: number
  price_p: number
  purchase_qty: number
  base_unit: 'ml' | 'each' | 'g'
  latest_count_at: string | null
  latest_count_qty: number | null
  previous_count_at: string | null
  theoretical_used_ml: number
  actual_used_ml: number | null
  variance_ml: number | null
  variance_pct: number | null
  variance_cost_p: number | null
  severity: 'none' | 'within-tolerance' | 'amber' | 'red'
  impact_p: number
  unmatched_in_window: number
  deliveries_in_window: number
  batches_in_window: number
  latest_reason: string | null
  persistent_loss: boolean
  trend: RollingTrendPoint[]
}

interface VarianceApiResponse {
  rows: RollingVarianceRow[]
}

const inputClass =
  'w-24 px-2 py-1 bg-white border border-slate-300 rounded-sm text-slate-900 text-sm focus:border-emerald-500 focus:outline-hidden'

const selectClass =
  'px-2 py-1 bg-white border border-slate-300 rounded-sm text-slate-900 text-sm focus:border-emerald-500 focus:outline-hidden'

function formatMoney(p: number): string {
  const sign = p < 0 ? '-' : ''
  return `${sign}£${(Math.abs(p) / 100).toFixed(2)}`
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function severityClass(severity: RollingVarianceRow['severity']): string {
  switch (severity) {
    case 'within-tolerance': return statusText('good')
    case 'amber': return statusText('watch')
    case 'red': return statusText('bad')
    default: return statusText('neutral')
  }
}

export function VarianceEditor() {
  const [rows, setRows] = useState<RollingVarianceRow[] | null>(null)
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [openTrend, setOpenTrend] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/pouriq/variance')
      .then((r) =>
        r.ok
          ? (r.json() as Promise<VarianceApiResponse>)
          : Promise.reject(new Error('Could not load variance data')),
      )
      .then((d) => setRows(d.rows))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function saveCount(id: string) {
    const raw = counts[id]
    const qty = parseFloat(raw)
    if (!Number.isFinite(qty) || qty < 0) return
    startTransition(async () => {
      setError(null)
      const res = await fetch('/api/pouriq/variance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          library_ingredient_id: id,
          count_qty: qty,
          reason: reasons[id] || undefined,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: 'Save failed' }))) as { error?: string }
        setError(err.error ?? 'Save failed')
        return
      }
      const data = (await res.json()) as VarianceApiResponse
      setRows(data.rows)
      setCounts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setReasons((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    })
  }

  if (loading) return <p className="text-sm text-slate-600">Loading variance data…</p>
  if (error && !rows) return <p role="alert" className="text-sm text-rose-600">{error}</p>
  if (!rows) return null
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        No bottle-priced ingredients in your library yet. Add ingredients before counting stock.
      </p>
    )
  }

  const reasonSummary = summariseVarianceByReason(
    rows.filter((r) => r.unmatched_in_window === 0),
  )

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {reasonSummary.total_loss_p > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Where the variance went</h2>
          <p className="text-xs text-slate-500 mb-3">Total loss this period {formatMoney(-reasonSummary.total_loss_p)}</p>
          <ul className="space-y-1">
            {reasonSummary.rows.map((r) => (
              <li key={r.reason} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-slate-700">{r.reason === 'unattributed' ? 'Unattributed' : r.reason.charAt(0).toUpperCase() + r.reason.slice(1)}</span>
                <span className="text-slate-600 font-mono">{formatMoney(-r.loss_p)} · {r.share_pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-3">
        {rows.map((row) => {
          const id = row.library_ingredient_id
          const unitLabel = row.base_unit
          const countLabel = row.base_unit === 'ml' ? 'bottles' : row.base_unit
          const countVal = counts[id] ?? ''
          const countNum = parseFloat(countVal)
          const saveEnabled = !pending && Number.isFinite(countNum) && countNum >= 0
          const showVariance =
            row.variance_cost_p !== null && row.unmatched_in_window === 0
          const showReason = row.severity === 'amber' || row.severity === 'red'
          const isTrendOpen = openTrend === id

          return (
            <div
              key={id}
              className="bg-white border border-slate-200 rounded-xl p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                  <span className="text-slate-900 font-medium">{row.library_name}</span>
                  <span className="text-slate-500 text-sm ml-1">({row.pack_size}{row.base_unit === 'ml' ? unitLabel : ` ${unitLabel}`})</span>
                  {row.persistent_loss && (
                    <span className="ml-2 inline-block px-1.5 py-0.5 rounded-sm bg-rose-50 text-rose-600 border border-rose-200 text-[10px] uppercase tracking-widest">
                      persistent loss
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Link href={`/variance/${id}`} className="text-xs text-emerald-700 hover:text-emerald-600 underline">View detail →</Link>
                  <button
                    type="button"
                    onClick={() => setOpenTrend(isTrendOpen ? null : id)}
                    className="text-xs text-slate-500 hover:text-slate-700 underline"
                  >
                    {isTrendOpen ? 'Hide trend' : 'Trend'}
                  </button>
                </div>
              </div>

              <div className="text-sm text-slate-500 mb-3 space-y-0.5">
                {row.latest_count_at ? (
                  <p>
                    Last count: {formatShortDate(row.latest_count_at)}
                    {row.latest_count_qty !== null && (
                      <span className="text-slate-700 ml-1">· {row.latest_count_qty} {countLabel}</span>
                    )}
                  </p>
                ) : (
                  <p>Never counted</p>
                )}
                {row.previous_count_at && (
                  <p>Expected used since last count: {Math.round(row.theoretical_used_ml)} {unitLabel}</p>
                )}
              </div>

              {showVariance && (
                <div className={`text-sm mb-3 ${severityClass(row.severity)}`}>
                  {row.severity === 'within-tolerance' ? (
                    <span>Within tolerance</span>
                  ) : (
                    <>
                      {row.variance_ml !== null && <span>{Math.round(row.variance_ml)} {unitLabel}</span>}
                      {row.variance_pct !== null && (
                        <span className="ml-2">({row.variance_pct.toFixed(1)}%)</span>
                      )}
                      <span className="ml-2">{formatMoney(row.variance_cost_p as number)}</span>
                    </>
                  )}
                </div>
              )}

              {row.unmatched_in_window > 0 && (
                <p className="text-sm text-amber-600 mb-3">
                  <Link href="/unmatched" className="underline hover:text-amber-700">
                    Usage understated, {row.unmatched_in_window} unmapped sales this period
                  </Link>
                </p>
              )}

              {(row.deliveries_in_window > 0 || row.batches_in_window > 0) && (
                <p className="text-xs text-slate-500 mb-3">
                  Accounts for{' '}
                  {[
                    row.deliveries_in_window > 0 ? `${row.deliveries_in_window} ${row.deliveries_in_window === 1 ? 'delivery' : 'deliveries'}` : null,
                    row.batches_in_window > 0 ? `${row.batches_in_window} ${row.batches_in_window === 1 ? 'batch' : 'batches'}` : null,
                  ].filter(Boolean).join(', ')}{' '}this period.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  step={row.base_unit === 'each' ? 1 : 0.1}
                  min={0}
                  value={countVal}
                  onChange={(e) => setCounts((prev) => ({ ...prev, [id]: e.target.value }))}
                  className={inputClass}
                  placeholder={countLabel}
                  aria-label={`${row.library_name} count now`}
                />
                {showReason && (
                  <select
                    value={reasons[id] ?? ''}
                    onChange={(e) => setReasons((prev) => ({ ...prev, [id]: e.target.value }))}
                    className={selectClass}
                    aria-label={`${row.library_name} reason`}
                  >
                    <option value="">reason (optional)</option>
                    {VARIANCE_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => saveCount(id)}
                  disabled={!saveEnabled}
                  className={SECONDARY_BUTTON_SM}
                >
                  Save count
                </button>
              </div>

              {isTrendOpen && row.trend.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                  {row.trend.map((point, i) => (
                    <div key={i} className="text-xs text-slate-500 flex gap-3">
                      <span className="text-slate-600">{formatShortDate(point.counted_at)}</span>
                      {point.variance_cost_p !== null && (
                        <span className={point.variance_cost_p < 0 ? 'text-rose-600' : 'text-slate-700'}>
                          {formatMoney(point.variance_cost_p)}
                        </span>
                      )}
                      {point.reason && <span>{point.reason}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
