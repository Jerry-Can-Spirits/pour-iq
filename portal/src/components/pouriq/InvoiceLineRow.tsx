'use client'

import { memo } from 'react'
import type { PreviewLine } from '@/app/api/pouriq/invoices/extract/route'
import { ALL_INGREDIENT_TYPES, type IngredientLibraryRow, type IngredientType } from '@/lib/pouriq/types'
import { PriceInput } from '@/components/pouriq/PriceInput'
import { LibrarySearchSelect } from '@/components/pouriq/LibrarySearchSelect'
import { netPriceP } from '@/lib/pouriq/calculations'

export type LineState = {
  applied: boolean
  unit_price_p: number
  match:
    | { kind: 'existing'; library_id: string | null }
    | {
        kind: 'new'
        new_name: string
        new_type: IngredientType
        base_unit: 'ml' | 'g' | 'each'
        pack_size: number
        purchase_qty: number
      }
}

interface InvoiceLineRowProps {
  index: number
  line: PreviewLine
  state: LineState
  libraryEntries: IngredientLibraryRow[]
  libraryById: Map<string, IngredientLibraryRow>
  pricesIncludeVat: boolean
  onChange: (index: number, patch: Partial<LineState>) => void
  onToggleCreateNew: (index: number, toNew: boolean) => void
}

function formatMoney(p: number): string {
  return `£${(p / 100).toFixed(2)}`
}

function currentCostFor(libraryById: Map<string, IngredientLibraryRow>, libraryId: string | null): number | null {
  if (!libraryId) return null
  const entry = libraryById.get(libraryId)
  if (!entry) return null
  return entry.price_p > 0 ? entry.price_p : null
}

function InvoiceLineRowComponent({ index, line, state, libraryEntries, libraryById, pricesIncludeVat, onChange, onToggleCreateNew }: InvoiceLineRowProps) {
  const match = state.match
  const libraryId = match.kind === 'existing' ? match.library_id : null
  const currentP = currentCostFor(libraryById, libraryId)
  const netNewP = netPriceP(state.unit_price_p, pricesIncludeVat)
  const delta = currentP !== null ? netNewP - currentP : null

  return (
    <tr className="border-t border-slate-200 align-top">
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={state.applied}
          onChange={(e) => onChange(index, { applied: e.target.checked })}
          className="h-4 w-4"
          aria-label={`Apply line ${index + 1}`}
        />
      </td>
      <td className="px-3 py-3 text-slate-900">
        <div className="font-medium">{line.extracted_name}</div>
        {line.extracted_line_total_p !== null && (
          <div className="text-xs text-slate-500 mt-1">Line total {formatMoney(line.extracted_line_total_p)}</div>
        )}
      </td>
      <td className="px-3 py-3 text-slate-600">{line.extracted_quantity ?? '—'}</td>
      <td className="px-3 py-3">
        <PriceInput
          valueP={state.unit_price_p}
          onChangeP={(p) => onChange(index, { unit_price_p: p })}
          className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-sm text-slate-900"
          aria-label={`New net price for line ${index + 1}`}
        />
      </td>
      <td className="px-3 py-3">
        {match.kind === 'new' ? (
          <div className="space-y-2 min-w-[260px]">
            {line.match.kind === 'catalogue' && (
              <p className="text-xs text-sky-600">from catalogue. Set your price.</p>
            )}
            <input
              value={match.new_name}
              onChange={(e) => onChange(index, { match: { ...match, new_name: e.target.value } })}
              placeholder="Name"
              className="w-full px-2 py-1 bg-white border border-slate-300 rounded-sm text-slate-900 text-sm"
            />
            <div className="flex gap-2">
              <select
                value={match.new_type}
                onChange={(e) => onChange(index, { match: { ...match, new_type: e.target.value as IngredientType } })}
                className="px-2 py-1 bg-white border border-slate-300 rounded-sm text-slate-900 text-sm"
              >
                {ALL_INGREDIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={match.base_unit}
                onChange={(e) => {
                  const bu = e.target.value as 'ml' | 'g' | 'each'
                  const defaultSize = bu === 'ml' ? 700 : bu === 'g' ? 1000 : 1
                  onChange(index, { match: { ...match, base_unit: bu, pack_size: defaultSize } })
                }}
                className="px-2 py-1 bg-white border border-slate-300 rounded-sm text-slate-900 text-sm"
              >
                <option value="ml">Liquid (ml)</option>
                <option value="g">Weight (g)</option>
                <option value="each">Count (each)</option>
              </select>
            </div>
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-slate-500">
                How many bought
                <input
                  type="number" min={1} step="1"
                  value={match.purchase_qty}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => onChange(index, { match: { ...match, purchase_qty: Math.max(1, Math.round(Number(e.target.value) || 1)) } })}
                  className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded-sm text-slate-900 text-sm"
                />
              </label>
              {match.base_unit !== 'each' && (
                <label className="flex-1 text-xs text-slate-500">
                  {match.base_unit === 'ml' ? 'Size each (ml)' : 'Weight each (g)'}
                  <input
                    type="number" min={1} step="1"
                    value={match.pack_size}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => onChange(index, { match: { ...match, pack_size: Math.max(1, Math.round(Number(e.target.value) || 1)) } })}
                    className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded-sm text-slate-900 text-sm"
                  />
                </label>
              )}
            </div>
            <button type="button" onClick={() => onToggleCreateNew(index, false)} className="text-xs text-slate-500 hover:text-slate-700 underline">
              Cancel new entry
            </button>
          </div>
        ) : (
          <div className="space-y-1 min-w-[220px]">
            {match.library_id ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-900">
                  {libraryById.get(match.library_id)?.name ?? match.library_id}
                </p>
                <button
                  type="button"
                  onClick={() => onChange(index, { match: { kind: 'existing', library_id: null } })}
                  className="shrink-0 text-xs text-slate-500 hover:text-slate-700"
                >
                  Change
                </button>
              </div>
            ) : (
              <LibrarySearchSelect
                libraryEntries={libraryEntries}
                onPick={(e) => onChange(index, { match: { kind: 'existing', library_id: e.id } })}
                onRequestCreate={() => onToggleCreateNew(index, true)}
                placeholder="Search library…"
              />
            )}
            <button type="button" onClick={() => onToggleCreateNew(index, true)} className="text-xs text-emerald-700 hover:text-emerald-600 underline">
              Create new library entry
            </button>
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-slate-700">
        {currentP !== null ? formatMoney(currentP) : '—'}
      </td>
      <td className={`px-3 py-3 ${delta !== null && delta > 0 ? 'text-amber-600' : delta !== null && delta < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
        {delta === null ? '—' : `${delta > 0 ? '+' : ''}${formatMoney(delta)}`}
      </td>
    </tr>
  )
}

export const InvoiceLineRow = memo(InvoiceLineRowComponent)
