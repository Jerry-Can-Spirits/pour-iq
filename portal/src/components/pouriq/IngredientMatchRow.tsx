'use client'

import { ALL_INGREDIENT_TYPES, type IngredientLibraryRow, type IngredientType, type ServeUnitRow } from '@/lib/pouriq/types'
import { PriceInput } from '@/components/pouriq/PriceInput'
import { ServeUnitPicker } from '@/components/pouriq/ServeUnitPicker'
import { LibrarySearchSelect } from '@/components/pouriq/LibrarySearchSelect'
import { BOTTLE_SIZES_ML, WEIGHT_SIZES_G, KEG_SIZES_ML, parsePackFormat } from '@/lib/pouriq/measures'
import type { ServeUnit } from '@/lib/pouriq/measures'
import { formatPurchaseBasis } from '@/lib/pouriq/calculations'

const inputClass = 'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-emerald-500 focus:outline-hidden'
const labelClass = 'block text-xs font-medium text-slate-600 mb-1'
const chipClass = 'px-2 py-1 rounded-sm border text-xs transition-colors'
const chipActive = 'bg-emerald-50 border-emerald-600 text-emerald-700'
const chipIdle = 'bg-white border-slate-300 text-slate-600 hover:border-emerald-400'

export interface MatchRowState {
  // Either picked an existing library entry...
  existing_library_id?: string
  // ...or staged a new library entry to be created on commit.
  new_library?: {
    name: string
    ingredient_type: IngredientType
    base_unit: 'ml' | 'g' | 'each'
    pack_size: number
    price_p: number | null
    price_includes_vat: boolean
    purchase_qty: number
    pack_format?: string | null
    subcategory?: string | null
  }
  pour_ml: number | null
  unit_count: number | null
  recipe_unit: string | null
  recipe_qty: number | null
  /** Product name this row's resolution was copied from during bulk-fill. */
  bulk_filled_from?: string
}

interface Props {
  extractedName: string
  rawMeasurement: string
  inferredType: IngredientType
  matchKind: 'auto' | 'suggestions' | 'no-match' | 'catalogue'
  libraryEntries: IngredientLibraryRow[]
  serveUnits: Record<string, ServeUnitRow[]>
  state: MatchRowState
  onChange: (state: MatchRowState) => void
  // Fired when this row becomes resolved (existing entry picked, or a new
  // entry's price field blurred) so the parent can bulk-fill matching rows.
  onResolvedCommit?: () => void
  // Number of other drinks whose resolution was propagated from this row.
  sharedWithCount?: number
  // Priced new entries staged elsewhere in the same import, offered as pick
  // targets ("Gin" can resolve to the "Gordon's" being created three rows up).
  stagedEntries?: Array<{ name: string; ingredient_type: IngredientType }>
  onPickStaged?: (name: string) => void
}

function resolvedBaseUnit(state: MatchRowState, library: IngredientLibraryRow[]): 'ml' | 'g' | 'each' {
  if (state.new_library) return state.new_library.base_unit
  if (state.existing_library_id) {
    return library.find((e) => e.id === state.existing_library_id)?.base_unit ?? 'ml'
  }
  return 'ml'
}

export function IngredientMatchRow({
  extractedName, rawMeasurement, inferredType,
  matchKind, libraryEntries, serveUnits,
  state, onChange, onResolvedCommit, sharedWithCount,
  stagedEntries, onPickStaged,
}: Props) {
  const baseUnit = resolvedBaseUnit(state, libraryEntries)
  const selectedExisting = state.existing_library_id
    ? libraryEntries.find((e) => e.id === state.existing_library_id) ?? null
    : null

  const customUnits: ServeUnit[] = selectedExisting
    ? (serveUnits[selectedExisting.id] ?? [])
    : []

  function startNewLibrary(name?: string) {
    const entryName = name ?? extractedName
    const pack = parsePackFormat(entryName)
    onChange({
      existing_library_id: undefined,
      new_library: {
        name: entryName,
        ingredient_type: inferredType,
        base_unit: 'ml',
        pack_size: pack?.pack_size ?? 700,
        price_p: null,
        price_includes_vat: false,
        purchase_qty: pack?.purchase_qty ?? 1,
      },
      pour_ml: state.pour_ml,
      unit_count: state.unit_count,
      recipe_unit: state.recipe_unit,
      recipe_qty: state.recipe_qty,
    })
  }

  function updateNewLibrary(patch: Partial<NonNullable<MatchRowState['new_library']>>) {
    if (!state.new_library) return
    onChange({ ...state, new_library: { ...state.new_library, ...patch } })
  }

  const matchBadge = matchKind === 'auto'
    ? <span className="text-xs text-emerald-600">auto-matched</span>
    : matchKind === 'catalogue'
      ? <span className="text-xs text-sky-600">from catalogue — set your price</span>
      : matchKind === 'suggestions'
        ? <span className="text-xs text-amber-600">pick a match</span>
        : <span className="text-xs text-rose-600">no match in library</span>

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-900 font-medium">{extractedName}</p>
          <p className="text-xs text-slate-500 mt-1">menu: &ldquo;{rawMeasurement}&rdquo; · type: {inferredType}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {matchBadge}
          {sharedWithCount !== undefined && sharedWithCount > 0 && (
            <span className="text-xs text-slate-500">
              Shared with {sharedWithCount} other {sharedWithCount === 1 ? 'drink' : 'drinks'}
            </span>
          )}
        </div>
      </div>

      {/* Match selection */}
      <div>
        <label className={labelClass}>Library entry</label>
        {state.bulk_filled_from ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">Priced via {state.bulk_filled_from}</p>
            <button
              type="button"
              onClick={() => onChange({ ...state, bulk_filled_from: undefined, existing_library_id: undefined, new_library: undefined })}
              className="shrink-0 text-xs text-slate-500 hover:text-slate-700"
            >
              Change
            </button>
          </div>
        ) : state.new_library ? (
          <div className="space-y-2 p-3 rounded-sm border border-slate-200 bg-slate-50">
            <div className="flex items-baseline justify-between">
              <p className="text-xs text-emerald-700">Creating new library entry</p>
              <button type="button" onClick={() => onChange({ existing_library_id: undefined, new_library: undefined, pour_ml: state.pour_ml, unit_count: state.unit_count, recipe_unit: state.recipe_unit, recipe_qty: state.recipe_qty })} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
            </div>
            <input value={state.new_library.name} onChange={(e) => updateNewLibrary({ name: e.target.value })} className={inputClass} placeholder="Name" />
            {(() => {
              const nl = state.new_library
              const basis = nl.price_p !== null && nl.price_p > 0
                ? formatPurchaseBasis({ base_unit: nl.base_unit, pack_size: nl.pack_size, price_p: nl.price_p, purchase_qty: nl.purchase_qty })
                : null
              const sizePresets = nl.base_unit === 'ml'
                ? (nl.ingredient_type === 'beer' || nl.ingredient_type === 'cider' || nl.ingredient_type === 'alcohol-free' ? [...BOTTLE_SIZES_ML, ...KEG_SIZES_ML] : BOTTLE_SIZES_ML)
                : nl.base_unit === 'g' ? WEIGHT_SIZES_G : null
              return (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={nl.ingredient_type} onChange={(e) => updateNewLibrary({ ingredient_type: e.target.value as IngredientType })} className={inputClass}>
                      {ALL_INGREDIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select
                      value={nl.base_unit}
                      onChange={(e) => {
                        const bu = e.target.value as 'ml' | 'g' | 'each'
                        const defaultSize = bu === 'ml' ? 700 : bu === 'g' ? 1000 : 1
                        updateNewLibrary({ base_unit: bu, pack_size: defaultSize })
                      }}
                      className={inputClass}
                    >
                      <option value="ml">Liquid (ml)</option>
                      <option value="g">Weight (g)</option>
                      <option value="each">Count (each)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={labelClass}>Price paid (£)</label>
                        <div role="group" aria-label="Price VAT basis" className="inline-flex items-stretch rounded border border-slate-300 overflow-hidden bg-white">
                          <button type="button" onClick={() => updateNewLibrary({ price_includes_vat: true })} aria-pressed={nl.price_includes_vat}
                            className={`px-2 py-0.5 text-xs font-semibold transition-colors ${nl.price_includes_vat ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}>
                            Inc VAT
                          </button>
                          <span aria-hidden="true" className="w-px bg-slate-300" />
                          <button type="button" onClick={() => updateNewLibrary({ price_includes_vat: false })} aria-pressed={!nl.price_includes_vat}
                            className={`px-2 py-0.5 text-xs font-semibold transition-colors ${!nl.price_includes_vat ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}>
                            Ex VAT
                          </button>
                        </div>
                      </div>
                      <PriceInput
                        valueP={nl.price_p}
                        onChangeP={(p) => updateNewLibrary({ price_p: p })}
                        onCommit={onResolvedCommit}
                        className={inputClass} placeholder="14.40" />
                      <p className="text-xs text-slate-500 mt-1">
                        {nl.price_includes_vat ? 'Price including VAT (stored net, divided by 1.2).' : 'Ex-VAT (net) cost from your supplier.'}
                      </p>
                    </div>
                    <div>
                      <label className={labelClass}>How many does that buy?</label>
                      <input
                        type="number" step="1" min={1}
                        value={nl.purchase_qty}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateNewLibrary({ purchase_qty: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                        className={inputClass} placeholder="1" />
                      <p className="text-xs text-slate-500 mt-1">
                        {nl.base_unit === 'each' ? 'e.g. 6 for a 6-pack' : 'e.g. 24 for a case'}
                      </p>
                    </div>
                  </div>
                  {nl.base_unit !== 'each' && (
                    <div>
                      <label className={labelClass}>
                        {nl.base_unit === 'ml' ? 'Size of each (ml)' : 'Weight per pack (g)'}
                      </label>
                      {sizePresets && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {sizePresets.map((s) => (
                            <button type="button" key={s} onClick={() => updateNewLibrary({ pack_size: s })}
                              className={`${chipClass} ${nl.pack_size === s ? chipActive : chipIdle}`}>
                              {nl.base_unit === 'ml' && s >= 10000 ? `${s / 1000}L` : `${s}${nl.base_unit}`}
                            </button>
                          ))}
                        </div>
                      )}
                      <input
                        type="number" step="1" min={1}
                        value={nl.pack_size}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateNewLibrary({ pack_size: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                        className={inputClass}
                        placeholder={nl.base_unit === 'ml' ? '330 for a can, 50000 for a 50L keg' : '500, 1000, 2500…'} />
                      <p className="text-xs text-slate-500 mt-1">Enter any size not shown above.</p>
                    </div>
                  )}
                  {basis !== null && <p className="text-xs text-emerald-700">= {basis}</p>}
                </>
              )
            })()}
          </div>
        ) : (
          <div className="space-y-2">
            {state.existing_library_id ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-900">
                  {selectedExisting
                    ? <>
                        {selectedExisting.name}
                        {selectedExisting.base_unit !== 'each'
                          ? <span className="text-xs text-slate-500 ml-2">· £{(selectedExisting.price_p / 100).toFixed(2)} / {selectedExisting.pack_size}{selectedExisting.base_unit}</span>
                          : <span className="text-xs text-slate-500 ml-2">· £{(selectedExisting.price_p / 100).toFixed(2)} each</span>}
                      </>
                    : state.existing_library_id}
                </p>
                <button
                  type="button"
                  onClick={() => onChange({ ...state, existing_library_id: undefined })}
                  className="shrink-0 text-xs text-slate-500 hover:text-slate-700"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <LibrarySearchSelect
                  libraryEntries={libraryEntries}
                  inferredType={inferredType}
                  createName={extractedName}
                  stagedEntries={stagedEntries}
                  onPickStaged={onPickStaged}
                  onPick={(e) => {
                    onChange({
                      existing_library_id: e.id,
                      new_library: undefined,
                      pour_ml: state.pour_ml,
                      unit_count: state.unit_count,
                      recipe_unit: state.recipe_unit,
                      recipe_qty: state.recipe_qty,
                    })
                    onResolvedCommit?.()
                  }}
                  onRequestCreate={(q) => startNewLibrary(q.trim() || undefined)}
                />
                <button
                  type="button"
                  onClick={() => startNewLibrary()}
                  className="text-xs text-emerald-700 hover:text-emerald-800"
                >
                  + Create &ldquo;{extractedName}&rdquo; as a new ingredient
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Serve unit picker */}
      {(state.existing_library_id || state.new_library) && (
        <ServeUnitPicker
          baseUnit={baseUnit}
          customUnits={customUnits}
          recipeUnit={state.recipe_unit}
          recipeQty={state.recipe_qty}
          onChange={(next) => onChange({ ...state, ...next })}
        />
      )}
    </div>
  )
}
