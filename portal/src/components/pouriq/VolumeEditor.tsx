'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PRIMARY_BUTTON, SECONDARY_BUTTON_SM } from '@/lib/pouriq/button-styles'
import { INPUT } from '@/lib/pouriq/ui'
import type { CocktailRow, CocktailMetrics, VolumeCadence } from '@/lib/pouriq/types'

const inputClass = 'w-24 px-2 py-1 bg-white border border-slate-300 rounded-sm text-slate-900 text-sm focus:border-emerald-500 focus:outline-hidden'

function formatMoney(p: number): string { return `£${(p / 100).toFixed(2)}` }
function formatDateRange(start: string, end: string): string {
  const fmt = (s: string) => {
    const d = new Date(s)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return `${fmt(start)} – ${fmt(end)}`
}

interface PeriodSummary {
  period_start: string
  period_end: string
  total_units: number
  total_contribution_p: number
  entries: Array<{ cocktail_id: string; units_sold: number; period_start: string; period_end: string }>
}

interface VolumesResponse {
  cadence: VolumeCadence
  current_period: { start: string; end: string }
  periods: PeriodSummary[]
}

interface Props {
  menuId: string
  cocktails: CocktailRow[]
  metrics: CocktailMetrics[]
  initialCadence: VolumeCadence
}

export function VolumeEditor({ menuId, cocktails, metrics, initialCadence }: Props) {
  const router = useRouter()
  const [cadence, setCadence] = useState<VolumeCadence>(initialCadence)
  const [data, setData] = useState<VolumesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pending, startTransition] = useTransition()

  const marginByCocktail = new Map(metrics.map((m) => [m.cocktail_id, m.margin_p]))

  // Load volumes. The cadence query param lets the API return the
  // current_period for whichever tab the user is on, without waiting
  // for the cadence PUT to round-trip — otherwise tab toggles race and
  // the "Current period" line shows the old cadence's range.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/pouriq/menus/${encodeURIComponent(menuId)}/volumes?cadence=${cadence}`)
      .then((r) => r.ok ? r.json() as Promise<VolumesResponse> : Promise.reject(new Error('Could not load volumes')))
      .then((d) => {
        if (cancelled) return
        setData(d)
        // Seed edit state with the current period's entries if any.
        const cur = d.periods.find((p) =>
          p.period_start === d.current_period.start && p.period_end === d.current_period.end
        )
        const seed: Record<string, string> = {}
        if (cur) for (const e of cur.entries) seed[e.cocktail_id] = String(e.units_sold)
        setEdits(seed)
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [menuId, cadence])

  async function changeCadence(next: VolumeCadence) {
    if (next === cadence || pending) return
    setError(null); setInfo(null)
    setCadence(next)
    startTransition(async () => {
      const res = await fetch(`/api/pouriq/menus/${encodeURIComponent(menuId)}/cadence`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cadence: next }),
      })
      if (!res.ok) {
        setCadence(cadence)
        const err = await res.json().catch(() => ({ error: 'Could not change cadence' })) as { error?: string }
        setError(err.error ?? 'Could not change cadence')
      } else {
        router.refresh()
      }
    })
  }

  function save() {
    if (!data) return
    setError(null); setInfo(null)
    const entries: Array<{ cocktail_id: string; units_sold: number }> = []
    for (const c of cocktails) {
      const raw = edits[c.id]
      if (raw === undefined || raw === '') continue
      const n = parseInt(raw, 10)
      if (!Number.isInteger(n) || n < 0) {
        setError(`${c.name}: units must be a non-negative whole number`)
        return
      }
      entries.push({ cocktail_id: c.id, units_sold: n })
    }
    startTransition(async () => {
      const res = await fetch(`/api/pouriq/menus/${encodeURIComponent(menuId)}/volumes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_start: data.current_period.start,
          period_end: data.current_period.end,
          entries,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Save failed' })) as { error?: string }
        setError(err.error ?? 'Save failed')
        return
      }
      setInfo(`Saved ${entries.length} drink${entries.length === 1 ? '' : 's'}.`)
      router.refresh()
    })
  }

  function applyPaste() {
    setError(null); setInfo(null)
    const lines = pasteText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) { setError('Paste at least one row'); return }

    const next: Record<string, string> = { ...edits }
    let matched = 0
    let unmatched = 0
    const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    const byName = new Map(cocktails.map((c) => [normalise(c.name), c.id]))

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Try "name<tab>number" or "name,number"; fall back to "just a number"
      // taken in order matching the cocktail list.
      const tabSplit = line.split(/\t|,/)
      if (tabSplit.length >= 2) {
        const name = normalise(tabSplit.slice(0, -1).join(' '))
        const numStr = tabSplit[tabSplit.length - 1].trim()
        const n = parseInt(numStr, 10)
        if (!Number.isInteger(n) || n < 0) { unmatched++; continue }
        const cocktailId = byName.get(name)
        if (cocktailId) {
          next[cocktailId] = String(n)
          matched++
        } else {
          unmatched++
        }
      } else {
        // Single number on the line — match by row order.
        const n = parseInt(line, 10)
        if (!Number.isInteger(n) || n < 0) { unmatched++; continue }
        const c = cocktails[i]
        if (!c) { unmatched++; continue }
        next[c.id] = String(n)
        matched++
      }
    }
    setEdits(next)
    setPasteOpen(false)
    setPasteText('')
    setInfo(`Matched ${matched} row${matched === 1 ? '' : 's'}${unmatched > 0 ? `, ${unmatched} ignored` : ''}. Review and save below.`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Sales volume</h2>
          {data && (
            <p className="text-xs text-slate-500 mt-1">
              Current period: {formatDateRange(data.current_period.start, data.current_period.end)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            role="group"
            aria-label="Reporting cadence"
            className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-white text-xs"
          >
            {(['weekly', 'monthly'] as VolumeCadence[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => changeCadence(c)}
                disabled={pending}
                aria-pressed={cadence === c}
                className={`px-3 py-1.5 font-semibold transition-colors ${cadence === c ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </span>
          <button type="button" onClick={() => setPasteOpen((v) => !v)} className={SECONDARY_BUTTON_SM}>
            Paste from POS
          </button>
        </div>
      </div>

      {pasteOpen && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-sm text-slate-700">
            Paste one of the following formats:
          </p>
          <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
            <li><span className="font-mono">Drink name TAB units</span> (one per line, matched by name)</li>
            <li><span className="font-mono">Drink name, units</span></li>
            <li><span className="font-mono">just numbers</span>, one per line, in the same order as drinks below</li>
          </ul>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={8}
            className={`${INPUT} text-xs font-mono`}
            placeholder={`Mojito\t28\nNegroni\t12\nEspresso Martini\t34`}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setPasteOpen(false); setPasteText('') }} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1">
              Cancel
            </button>
            <button type="button" onClick={applyPaste} className={SECONDARY_BUTTON_SM}>
              Match and fill
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-600">Loading volumes…</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-500 text-xs uppercase tracking-widest">
                <th className="px-4 py-3">Drink</th>
                <th className="px-4 py-3">Units sold</th>
                <th className="px-4 py-3">Margin / unit</th>
                <th className="px-4 py-3">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Total contribution across visible rows, so each row can
                // show its share as a percentage alongside the £ figure.
                let totalContribution = 0
                const rowContributions = new Map<string, number>()
                for (const c of cocktails) {
                  const raw = edits[c.id] ?? ''
                  const units = parseInt(raw, 10)
                  const margin = marginByCocktail.get(c.id) ?? 0
                  const contribution = Number.isFinite(units) && units > 0 ? margin * units : 0
                  rowContributions.set(c.id, contribution)
                  totalContribution += contribution
                }
                return cocktails.map((c) => {
                  const raw = edits[c.id] ?? ''
                  const units = parseInt(raw, 10)
                  const margin = marginByCocktail.get(c.id) ?? 0
                  const contribution = rowContributions.get(c.id) ?? 0
                  const hasUnits = Number.isFinite(units) && units > 0
                  const pct = hasUnits && totalContribution > 0
                    ? (contribution / totalContribution) * 100
                    : 0
                  return (
                    <tr key={c.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 text-slate-900">{c.name}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={raw}
                          onChange={(e) => setEdits((s) => ({ ...s, [c.id]: e.target.value }))}
                          className={inputClass}
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatMoney(margin)}</td>
                      <td className="px-4 py-3 text-slate-900">
                        {hasUnits ? (
                          <span>
                            {formatMoney(contribution)}
                            {totalContribution > 0 && (
                              <span className="text-slate-500 ml-2">· {pct.toFixed(1)}%</span>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {info && <p className="text-sm text-emerald-600">{info}</p>}

      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={pending || loading} className={PRIMARY_BUTTON}>
          {pending ? 'Saving…' : 'Save volumes'}
        </button>
      </div>

      {data && data.periods.length > 1 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-slate-900 mb-3">Recent periods</h3>
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[440px]">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-500 text-xs uppercase tracking-widest">
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Units</th>
                  <th className="px-4 py-3">Contribution</th>
                </tr>
              </thead>
              <tbody>
                {data.periods.slice(0, 6).map((p) => (
                  <tr key={`${p.period_start}-${p.period_end}`} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-900">{formatDateRange(p.period_start, p.period_end)}</td>
                    <td className="px-4 py-3 text-slate-700">{p.total_units}</td>
                    <td className="px-4 py-3 text-slate-900">{formatMoney(p.total_contribution_p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
