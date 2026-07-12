'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { IngredientLibraryRow } from '@/lib/pouriq/types'
import { formatPurchaseBasis } from '@/lib/pouriq/calculations'
import { filterIngredients } from '@/lib/pouriq/ingredient-filter'
import { bulkDeleteLibraryEntriesAction } from '@/lib/pouriq/server-actions'
import { DESTRUCTIVE_BUTTON, SECONDARY_BUTTON_SM } from '@/lib/pouriq/button-styles'
import { costConfidenceBadge, ingredientCompleteness } from '@/lib/pouriq/cost-confidence'

interface StockInfo { needs_reorder: boolean; reorder_qty: number; on_hand_bottles: number | null }

interface Props {
  entries: IngredientLibraryRow[]
  usageCounts: Map<string, number>
  stockById: Record<string, StockInfo>
}

const chipBase = 'text-xs rounded-full border px-3 py-1 transition-colors'
const chipActive = 'border-emerald-600 bg-emerald-50 text-emerald-700'
const chipIdle = 'border-slate-300 text-slate-600 hover:border-emerald-400'

export function IngredientList({ entries, usageCounts, stockById }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 border border-slate-200 text-center">
        <p className="text-slate-600 mb-2">No ingredients yet.</p>
        <p className="text-slate-500 text-sm">
          Add your first ingredient to begin building your library, or import a menu to populate automatically.
        </p>
      </div>
    )
  }

  const lowStockIds = new Set(entries.filter((e) => stockById[e.id]?.needs_reorder).map((e) => e.id))
  const types = [...new Set(entries.map((e) => e.ingredient_type))].sort()
  const visible = filterIngredients(entries, { search, category }, lowStockIds)
  // Bulk actions only ever touch what's currently visible, so changing the
  // filter can never silently delete a selected ingredient you can't see.
  const visibleSelectedIds = visible.filter((e) => selected.has(e.id)).map((e) => e.id)
  const deletableVisibleIds = visible.filter((e) => (usageCounts.get(e.id) ?? 0) === 0).map((e) => e.id)
  const allUnusedSelected = deletableVisibleIds.length > 0 && deletableVisibleIds.every((id) => selected.has(id))

  function toggleSelectAllUnused() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allUnusedSelected) {
        for (const id of deletableVisibleIds) next.delete(id)
      } else {
        for (const id of deletableVisibleIds) next.add(id)
      }
      return next
    })
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleBulkDelete() {
    const ids = visibleSelectedIds
    if (ids.length === 0) return
    if (!window.confirm(`Delete ${ids.length} ingredient${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    setError(null)
    startTransition(async () => {
      try {
        await bulkDeleteLibraryEntriesAction(ids)
        setSelected(new Set())
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed')
      }
    })
  }

  function stockCell(id: string) {
    const s = stockById[id]
    if (s?.needs_reorder) return <span className="text-amber-600">Low · order {s.reorder_qty}</span>
    if (s && s.on_hand_bottles != null) return <span className="text-slate-600">{Math.max(0, s.on_hand_bottles).toFixed(1)} left</span>
    return <span className="text-slate-400">—</span>
  }

  return (
    <div>
      {visibleSelectedIds.length > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-white border border-slate-200 rounded-xl">
          <span className="text-slate-700 text-sm flex-1">{visibleSelectedIds.length} selected</span>
          <button type="button" onClick={() => setSelected(new Set())} className={SECONDARY_BUTTON_SM} disabled={isPending}>Clear</button>
          <button type="button" onClick={handleBulkDelete} className={DESTRUCTIVE_BUTTON} disabled={isPending}>
            {isPending ? 'Deleting...' : `Delete ${visibleSelectedIds.length} selected`}
          </button>
        </div>
      )}
      {error && <p className="text-rose-600 text-sm mb-4">{error}</p>}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ingredients…"
          aria-label="Search ingredients"
          className="flex-1 min-w-[180px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-emerald-500 focus:outline-hidden"
        />
        {deletableVisibleIds.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allUnusedSelected}
              onChange={toggleSelectAllUnused}
              aria-label="Select all unused"
              className="h-4 w-4 accent-emerald-600"
            />
            Select all unused
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCategory('all')} className={`${chipBase} ${category === 'all' ? chipActive : chipIdle}`}>All</button>
          {types.map((t) => (
            <button key={t} type="button" onClick={() => setCategory(t)} className={`${chipBase} ${category === t ? chipActive : chipIdle}`}>{t}</button>
          ))}
          {lowStockIds.size > 0 && (
            <button
              type="button"
              onClick={() => setCategory('low-stock')}
              className={`${chipBase} ${category === 'low-stock' ? 'border-amber-600 bg-amber-50 text-amber-600' : 'border-amber-400 text-amber-600 hover:border-amber-500'}`}
            >
              Low stock
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-slate-500">No ingredients match your search or filter.</p>
      ) : (
        <>
          <div className="hidden lg:block bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-500 text-xs uppercase tracking-widest">
                  <th className="px-3 py-3 w-8"></th>
                  <th className="px-3 py-3">Ingredient</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Purchase &amp; cost</th>
                  <th className="px-3 py-3 text-right">Used in</th>
                  <th className="px-3 py-3">Stock</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((entry) => {
                  const count = usageCounts.get(entry.id) ?? 0
                  const b = costConfidenceBadge(entry.cost_confidence)
                  const { complete } = ingredientCompleteness(entry)
                  return (
                    <tr key={entry.id} className="border-t border-slate-200">
                      <td className="px-3 py-3">
                        {count === 0 && (
                          <input type="checkbox" checked={selected.has(entry.id)} onChange={() => toggleSelected(entry.id)} aria-label={`Select ${entry.name}`} className="h-4 w-4" />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/library/${entry.id}/edit`} className="text-slate-900 hover:text-emerald-700">{entry.name}</Link>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${b.className}`}>{b.label}</span>
                          {!complete && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-50 text-amber-700 border border-amber-500">incomplete</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-500">{entry.ingredient_type}</td>
                      <td className="px-3 py-3 text-slate-700">{formatPurchaseBasis(entry)}</td>
                      <td className="px-3 py-3 text-right text-slate-600">{count === 0 ? <span className="text-slate-400">0</span> : count}</td>
                      <td className="px-3 py-3">{stockCell(entry.id)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden grid sm:grid-cols-2 gap-4">
            {visible.map((entry) => {
              const count = usageCounts.get(entry.id) ?? 0
              const isUnused = count === 0
              const isChecked = selected.has(entry.id)
              const s = stockById[entry.id]
              const b = costConfidenceBadge(entry.cost_confidence)
              const { complete } = ingredientCompleteness(entry)
              return (
                <div key={entry.id} className="relative">
                  <Link href={`/library/${entry.id}/edit`} className="block bg-white rounded-xl p-5 border border-slate-200 hover:border-emerald-400 transition-colors">
                    <div className="flex items-baseline justify-between gap-2 mb-2">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 truncate">{entry.name}</h3>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${b.className}`}>{b.label}</span>
                          {!complete && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-50 text-amber-700 border border-amber-500">incomplete</span>}
                        </div>
                      </div>
                      <span className="text-xs uppercase tracking-widest text-slate-500 shrink-0">{entry.ingredient_type}</span>
                    </div>
                    <p className="text-slate-700 text-sm">{formatPurchaseBasis(entry)}</p>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <p className="text-slate-500 text-xs">{count === 0 ? 'Not used yet' : `Used in ${count} drink${count === 1 ? '' : 's'}`}</p>
                      {s?.needs_reorder && <span className="text-xs text-amber-600 shrink-0">Low · order {s.reorder_qty}</span>}
                    </div>
                  </Link>
                  {isUnused && (
                    <button
                      type="button"
                      aria-label={isChecked ? `Deselect ${entry.name}` : `Select ${entry.name}`}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelected(entry.id) }}
                      className="absolute top-3 right-3 flex items-center justify-center w-5 h-5 rounded border border-slate-400 bg-white hover:border-emerald-500 transition-colors"
                    >
                      {isChecked && (
                        <svg className="w-3 h-3 text-emerald-600" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
