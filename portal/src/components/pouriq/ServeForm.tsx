'use client'

import { useState } from 'react'
import { PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'
import { IngredientPicker } from '@/components/pouriq/IngredientPicker'
import { ServeUnitPicker } from '@/components/pouriq/ServeUnitPicker'
import type { IngredientLibraryRow, ServeUnitRow } from '@/lib/pouriq/types'
import { GLASS_OPTIONS } from '@/lib/pouriq/measures'
import type { ServeUnit } from '@/lib/pouriq/measures'

export interface ServeFormIngredient {
  library_ingredient_id: string
  pour_ml: number | null
  unit_count: number | null
  recipe_unit: string | null
  recipe_qty: number | null
  use_id: string | null
}

interface FormIngredient {
  library_entry: IngredientLibraryRow | null
  pour_ml: number | null
  unit_count: number | null
  recipe_unit: string | null
  recipe_qty: number | null
}

const inputClass = 'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden'
const labelClass = 'block text-xs font-medium text-slate-600 mb-1'
const chipClass = 'px-2 py-1 rounded-sm border text-xs transition-colors'
const chipActive = 'bg-emerald-50 border-emerald-600 text-emerald-700'
const chipIdle = 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400'

function blankIngredient(): FormIngredient {
  return { library_entry: null, pour_ml: null, unit_count: null, recipe_unit: null, recipe_qty: null }
}

interface Props {
  defaultName: string
  defaultGlass?: string | null
  defaultSalePriceP?: number
  defaultIngredients?: ServeFormIngredient[]
  libraryEntries: IngredientLibraryRow[]
  serveUnits: Record<string, ServeUnitRow[]>
  pending: boolean
  submitLabel: string
  onError: (message: string) => void
  onSubmit: (name: string, glass: string | null, ingredients: ServeFormIngredient[], salePriceP: number) => void
}

export function ServeForm({ defaultName, defaultGlass, defaultSalePriceP, defaultIngredients, libraryEntries, serveUnits, pending, submitLabel, onError, onSubmit }: Props) {
  const [name, setName] = useState(defaultName)
  const [glass, setGlass] = useState(defaultGlass ?? '')
  const [salePrice, setSalePrice] = useState(() =>
    defaultSalePriceP && defaultSalePriceP > 0 ? (defaultSalePriceP / 100).toFixed(2) : ''
  )
  const [ingredients, setIngredients] = useState<FormIngredient[]>(() => {
    if (!defaultIngredients || defaultIngredients.length === 0) return [blankIngredient()]
    return defaultIngredients.map((ing) => {
      const entry = libraryEntries.find((e) => e.id === ing.library_ingredient_id) ?? null
      return {
        library_entry: entry,
        pour_ml: ing.pour_ml,
        unit_count: ing.unit_count,
        recipe_unit: ing.recipe_unit,
        recipe_qty: ing.recipe_qty,
      }
    })
  })

  function updateIngredient(idx: number, patch: Partial<FormIngredient>) {
    setIngredients((arr) => arr.map((ing, i) => i === idx ? { ...ing, ...patch } : ing))
  }

  function submit() {
    if (!name.trim()) { onError('Serve name is required.'); return }
    const parsed: ServeFormIngredient[] = []
    for (let idx = 0; idx < ingredients.length; idx++) {
      const ing = ingredients[idx]
      if (!ing.library_entry) { onError(`Ingredient ${idx + 1}: pick an ingredient or remove the row.`); return }
      const baseUnit = ing.library_entry.base_unit
      if (baseUnit === 'each') {
        if (ing.unit_count === null || ing.unit_count <= 0) { onError(`Ingredient ${idx + 1} ("${ing.library_entry.name}"): quantity must be > 0.`); return }
      } else {
        if (ing.pour_ml === null || ing.pour_ml <= 0) { onError(`Ingredient ${idx + 1} ("${ing.library_entry.name}"): amount must be > 0.`); return }
      }
      parsed.push({
        library_ingredient_id: ing.library_entry.id,
        pour_ml: ing.pour_ml,
        unit_count: ing.unit_count,
        recipe_unit: ing.recipe_unit,
        recipe_qty: ing.recipe_qty,
        use_id: null,
      })
    }
    if (parsed.length === 0) { onError('Add at least one ingredient.'); return }
    const salePriceP = Math.round(parseFloat(salePrice || '0') * 100) || 0
    onSubmit(name.trim(), glass.trim() || null, parsed, salePriceP)
  }

  return (
    <div className="mt-4 border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-4">
      <div>
        <label className={labelClass}>Serve name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Glass</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {GLASS_OPTIONS.map((g) => (
            <button type="button" key={g} onClick={() => setGlass(g)}
              className={`${chipClass} ${glass === g ? chipActive : chipIdle}`}>
              {g}
            </button>
          ))}
        </div>
        <input value={glass} onChange={(e) => setGlass(e.target.value)} className={inputClass} placeholder="e.g. Rocks, Highball" />
      </div>
      <div>
        <label className={labelClass}>Sale price (£)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          className={inputClass}
          placeholder="e.g. 3.50"
        />
      </div>
      <div className="space-y-4">
        {ingredients.map((ing, idx) => {
          const entry = ing.library_entry
          const customUnits: ServeUnit[] = entry
            ? (serveUnits[entry.id] ?? [])
            : []
          return (
            <div key={idx} className="border border-slate-100 rounded-lg p-3 bg-white">
              <label className={labelClass}>Ingredient {idx + 1}</label>
              <IngredientPicker
                libraryEntries={libraryEntries}
                selectedEntryId={ing.library_entry?.id ?? null}
                onChange={(newEntry) => updateIngredient(idx, {
                  library_entry: newEntry,
                  pour_ml: null,
                  unit_count: null,
                  recipe_unit: null,
                  recipe_qty: null,
                })}
              />
              {entry && (
                <div className="mt-3">
                  <ServeUnitPicker
                    baseUnit={entry.base_unit}
                    customUnits={customUnits}
                    recipeUnit={ing.recipe_unit}
                    recipeQty={ing.recipe_qty}
                    onChange={(next) => updateIngredient(idx, next)}
                  />
                </div>
              )}
              {ingredients.length > 1 && (
                <button type="button" onClick={() => setIngredients((arr) => arr.filter((_, i) => i !== idx))} className="mt-3 text-xs text-slate-500 hover:text-rose-600 underline">
                  Remove ingredient
                </button>
              )}
            </div>
          )
        })}
      </div>
      <button type="button" onClick={() => setIngredients((arr) => [...arr, blankIngredient()])} className="text-sm text-emerald-700 hover:text-emerald-600 underline">
        Add another ingredient
      </button>
      <div className="flex justify-end">
        <button type="button" onClick={submit} disabled={pending} className={PRIMARY_BUTTON}>
          {pending ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  )
}
