'use client'

import { serveUnitsFor, recipeBaseAmount, type BaseUnit, type ServeUnit } from '@/lib/pouriq/measures'

const inputClass = 'px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-emerald-500 focus:outline-hidden'
const labelClass = 'block text-xs font-medium text-slate-600 mb-1'

interface PickerChange {
  recipe_unit: string
  recipe_qty: number
  pour_ml: number | null
  unit_count: number | null
}

interface Props {
  baseUnit: BaseUnit
  customUnits: ServeUnit[]
  recipeUnit: string | null
  recipeQty: number | null
  onChange: (next: PickerChange) => void
  costPerBaseUnitP?: number
}

const DEFAULT_UNIT_NAME: Record<BaseUnit, string> = {
  ml: 'ml',
  g: 'g',
  each: 'item',
}

export function ServeUnitPicker({
  baseUnit,
  customUnits,
  recipeUnit,
  recipeQty,
  onChange,
  costPerBaseUnitP,
}: Props) {
  const units = serveUnitsFor(baseUnit, customUnits)

  const resolvedUnitName = recipeUnit ?? DEFAULT_UNIT_NAME[baseUnit]
  const selectedUnit: ServeUnit =
    units.find((u) => u.name === resolvedUnitName) ?? units[0]

  const qty = recipeQty ?? 0

  function emit(unit: ServeUnit, newQty: number) {
    const base = recipeBaseAmount(newQty, unit.base_per_unit)
    onChange({
      recipe_unit: unit.name,
      recipe_qty: newQty,
      pour_ml: baseUnit !== 'each' ? base : null,
      unit_count: baseUnit === 'each' ? base : null,
    })
  }

  function handleUnitChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = units.find((u) => u.name === e.target.value) ?? units[0]
    emit(next, qty)
  }

  function handleQtyChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newQty = parseFloat(e.target.value) || 0
    emit(selectedUnit, newQty)
  }

  const base = recipeBaseAmount(qty, selectedUnit.base_per_unit)
  const costDisplay =
    costPerBaseUnitP !== undefined && qty > 0
      ? `£${((costPerBaseUnitP * base) / 100).toFixed(2)} per serve`
      : null

  return (
    <div>
      <label className={labelClass}>Amount per serve</label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          step="0.1"
          min={0}
          value={qty === 0 ? '' : qty}
          onChange={handleQtyChange}
          className={`${inputClass} w-24`}
          placeholder="0"
          aria-label="quantity"
        />
        <select
          value={selectedUnit.name}
          onChange={handleUnitChange}
          className={`${inputClass} min-w-24`}
          aria-label="unit"
        >
          {units.map((u) => (
            <option key={u.name} value={u.name}>
              {baseUnit === 'ml' && u.base_per_unit !== 1 ? `${u.name} (${u.base_per_unit}ml)` : u.name}
            </option>
          ))}
        </select>
        {costDisplay && (
          <span className="text-xs text-slate-500">{costDisplay}</span>
        )}
      </div>
    </div>
  )
}
