'use client'

import { useState, useTransition } from 'react'
import { PRIMARY_BUTTON, SECONDARY_BUTTON_SM, DESTRUCTIVE_BUTTON } from '@/lib/pouriq/button-styles'
import { ServeForm } from '@/components/pouriq/ServeForm'
import { saveServeAction } from '@/lib/pouriq/server-actions'
import type { IngredientLibraryRow, ServeUnitRow } from '@/lib/pouriq/types'

interface UnmatchedItem {
  normalised_name: string
  raw_name: string
  total_quantity: number
  last_seen: string
  suggestion: { cocktail_id: string; name: string } | null
}

interface Props {
  items: UnmatchedItem[]
  cocktails: Array<{ id: string; name: string }>
  serves: Array<{ id: string; name: string }>
  libraryEntries: IngredientLibraryRow[]
  serveUnits: Record<string, ServeUnitRow[]>
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function UnmatchedReview({ items, cocktails, serves, libraryEntries, serveUnits }: Props) {
  const [rows, setRows] = useState(items)
  const [serveList, setServeList] = useState(serves)
  const [selection, setSelection] = useState<Record<string, string>>(
    () => Object.fromEntries(items.map((i) => [i.normalised_name, i.suggestion?.cocktail_id ?? ''])),
  )
  const [serveSelection, setServeSelection] = useState<Record<string, string>>({})
  const [creatingFor, setCreatingFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function remove(name: string) {
    setRows((rs) => rs.filter((r) => r.normalised_name !== name))
  }

  async function postMap(body: Record<string, string>): Promise<boolean> {
    const res = await fetch('/api/pouriq/integrations/unmatched/map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({})) as { error?: string }
      setError(e.error ?? 'Could not save the mapping.')
      return false
    }
    return true
  }

  function confirm(name: string) {
    const cocktailId = selection[name]
    if (!cocktailId) { setError('Pick a cocktail first.'); return }
    setError(null)
    startTransition(async () => {
      if (await postMap({ normalisedName: name, cocktailId })) remove(name)
    })
  }

  function confirmServe(name: string) {
    const serveId = serveSelection[name]
    if (!serveId) { setError('Pick a serve first.'); return }
    setError(null)
    startTransition(async () => {
      if (await postMap({ normalisedName: name, target: 'serve', serveId })) remove(name)
    })
  }

  function ignore(name: string) {
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/pouriq/integrations/unmatched/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ normalisedName: name }),
      })
      if (!res.ok) { setError('Could not update that item.'); return }
      remove(name)
    })
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <p className="text-slate-900 font-medium mb-1">Nothing to review.</p>
        <p className="text-slate-500 text-sm">Every till item from your POS is matched to a cocktail.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {rows.map((row) => (
        <div key={row.normalised_name} className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="text-lg font-bold text-slate-900">{row.raw_name}</h2>
            <span className="text-xs text-slate-500">
              {row.total_quantity} {row.total_quantity === 1 ? 'sale' : 'sales'} waiting · last seen {formatDate(row.last_seen)}
            </span>
          </div>
          <label htmlFor={`map-${row.normalised_name}`} className="block text-xs font-medium text-slate-600 mb-2">
            This is a cocktail
          </label>
          <select
            id={`map-${row.normalised_name}`}
            value={selection[row.normalised_name] ?? ''}
            onChange={(e) => setSelection((s) => ({ ...s, [row.normalised_name]: e.target.value }))}
            disabled={pending}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden mb-2"
          >
            <option value="">— Select a cocktail —</option>
            {cocktails.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2 mb-4">
            <button type="button" onClick={() => confirm(row.normalised_name)} disabled={pending} className={PRIMARY_BUTTON}>
              {pending ? 'Saving…' : 'Confirm cocktail'}
            </button>
            <button type="button" onClick={() => ignore(row.normalised_name)} disabled={pending} className={DESTRUCTIVE_BUTTON}>
              Not a cocktail
            </button>
          </div>

          <label htmlFor={`serve-${row.normalised_name}`} className="block text-xs font-medium text-slate-600 mb-2">
            Or this is a serve
          </label>
          <select
            id={`serve-${row.normalised_name}`}
            value={serveSelection[row.normalised_name] ?? ''}
            onChange={(e) => setServeSelection((s) => ({ ...s, [row.normalised_name]: e.target.value }))}
            disabled={pending}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden mb-2"
          >
            <option value="">— Select a serve —</option>
            {serveList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => confirmServe(row.normalised_name)} disabled={pending} className={PRIMARY_BUTTON}>
              {pending ? 'Saving…' : 'Confirm serve'}
            </button>
            <button
              type="button"
              onClick={() => setCreatingFor((c) => c === row.normalised_name ? null : row.normalised_name)}
              disabled={pending}
              className={SECONDARY_BUTTON_SM}
            >
              {creatingFor === row.normalised_name ? 'Cancel new serve' : 'Create serve'}
            </button>
          </div>

          {creatingFor === row.normalised_name && (
            <ServeForm
              defaultName={row.raw_name}
              libraryEntries={libraryEntries}
              serveUnits={serveUnits}
              pending={pending}
              submitLabel="Create serve and map"
              onError={setError}
              onSubmit={(name, glass, ingredients) => {
                setError(null)
                startTransition(async () => {
                  try {
                    const { serveId } = await saveServeAction(null, { name, glass, ingredients })
                    if (await postMap({ normalisedName: row.normalised_name, target: 'serve', serveId })) {
                      setServeList((list) => [...list, { id: serveId, name }])
                      setCreatingFor(null)
                      remove(row.normalised_name)
                    }
                  } catch (e) {
                    setError((e as Error).message || 'Could not create the serve.')
                  }
                })
              }}
            />
          )}
        </div>
      ))}
      <p className="text-xs text-slate-500">
        Confirming a match also recovers the waiting sales (up to 90 days) and remembers the mapping for next time.
      </p>
    </div>
  )
}
