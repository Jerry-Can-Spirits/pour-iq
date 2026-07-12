'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { bulkApplyPromoAction, type BulkPromoMode } from '@/lib/pouriq/server-actions'
import { SECONDARY_BUTTON_SM, PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'

const inputClass = 'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-emerald-500 focus:outline-hidden'
const labelClass = 'block text-xs font-medium text-slate-600 mb-1'

interface Props {
  menuId: string
}

export function BulkPromoActions({ menuId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<BulkPromoMode>('percent')
  const [amountStr, setAmountStr] = useState('')
  const [label, setLabel] = useState('')
  const [days, setDays] = useState<number[]>([])
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function reset() {
    setMode('percent')
    setAmountStr('')
    setLabel('')
    setDays([])
    setValidFrom('')
    setValidUntil('')
    setError(null)
    setInfo(null)
  }

  function close() {
    setOpen(false)
    reset()
  }

  function apply() {
    setError(null)
    setInfo(null)
    let amount: number | undefined
    if (mode === 'percent') {
      amount = parseFloat(amountStr)
      if (!Number.isFinite(amount) || amount < 1 || amount > 99) {
        setError('Enter a percentage between 1 and 99')
        return
      }
    } else if (mode === 'flat') {
      const pounds = parseFloat(amountStr)
      if (!Number.isFinite(pounds) || pounds <= 0) {
        setError('Enter an amount greater than 0')
        return
      }
      amount = Math.round(pounds * 100)
    }
    const isoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim()) ? s.trim() : null
    const sortedDays = days.length > 0 && days.length < 7
      ? [...days].sort((a, b) => a - b).join(',')
      : null
    const vf = isoDate(validFrom)
    const vu = isoDate(validUntil)
    if (vf && vu && vu < vf) {
      setError('End date must be on or after start date')
      return
    }

    startTransition(async () => {
      try {
        const result = await bulkApplyPromoAction(menuId, {
          mode,
          amount,
          label: mode === 'clear' ? null : (label.trim() || null),
          days: mode === 'clear' ? null : sortedDays,
          valid_from: mode === 'clear' ? null : vf,
          valid_until: mode === 'clear' ? null : vu,
        })
        setInfo(
          mode === 'clear'
            ? `Cleared promos from ${result.updated} drink${result.updated === 1 ? '' : 's'}.`
            : `Applied to ${result.updated} drink${result.updated === 1 ? '' : 's'}.`,
        )
        router.refresh()
      } catch (e) {
        setError((e as Error).message || 'Could not apply promo')
      }
    })
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={SECONDARY_BUTTON_SM}>
        Bulk promo
      </button>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-slate-900">Apply a promo to every drink</h3>
        <button type="button" onClick={close} className="text-xs text-slate-500 hover:text-slate-700">Close</button>
      </div>

      <div role="group" aria-label="Promo mode" className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50 text-xs">
        {(['percent', 'flat', 'clear'] as BulkPromoMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null); setInfo(null) }}
            aria-pressed={mode === m}
            className={`px-3 py-1.5 font-semibold transition-colors ${mode === m ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {m === 'percent' ? '% off' : m === 'flat' ? '£ off' : 'Clear all'}
          </button>
        ))}
      </div>

      {mode !== 'clear' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="bulk_amount" className={labelClass}>
                {mode === 'percent' ? 'Percent off' : 'Amount off (£)'}
              </label>
              <input
                id="bulk_amount"
                type="number"
                step={mode === 'percent' ? '1' : '0.01'}
                min={0}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className={inputClass}
                placeholder={mode === 'percent' ? '20' : '2.00'}
              />
            </div>
            <div>
              <label htmlFor="bulk_label" className={labelClass}>Label (optional)</label>
              <input
                id="bulk_label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={inputClass}
                placeholder="e.g. Happy hour"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Active on (leave none for every day)</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 1, label: 'Mon' },
                { value: 2, label: 'Tue' },
                { value: 3, label: 'Wed' },
                { value: 4, label: 'Thu' },
                { value: 5, label: 'Fri' },
                { value: 6, label: 'Sat' },
                { value: 0, label: 'Sun' },
              ].map((d) => {
                const active = days.includes(d.value)
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDays((arr) => active ? arr.filter((n) => n !== d.value) : [...arr, d.value])}
                    className={`px-2 py-1 rounded-sm border text-xs transition-colors ${active ? 'bg-emerald-100 border-emerald-600 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400'}`}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="bulk_valid_from" className={labelClass}>Valid from (optional)</label>
              <input id="bulk_valid_from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="bulk_valid_until" className={labelClass}>Valid until (optional)</label>
              <input id="bulk_valid_until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputClass} />
            </div>
          </div>
        </>
      )}

      {mode === 'clear' && (
        <p className="text-xs text-slate-600">Removes the promo price and label from every drink on this menu. Can&rsquo;t be undone in bulk — drinks would need to be re-edited individually.</p>
      )}

      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {info && <p className="text-sm text-emerald-600">{info}</p>}

      <div className="flex justify-end">
        <button type="button" onClick={apply} disabled={pending} className={PRIMARY_BUTTON}>
          {pending ? 'Applying…' : mode === 'clear' ? 'Clear all promos' : 'Apply'}
        </button>
      </div>
    </div>
  )
}
