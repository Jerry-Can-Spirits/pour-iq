'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { IngredientLibraryRow, IngredientUseRow } from '@/lib/pouriq/types'
import { saveIngredientUsesAction } from '@/lib/pouriq/server-actions'
import { PRODUCE_LIBRARY } from '@/lib/pouriq/produce-library'
import { lineCostFromUseP, usableCostPerBaseUnitP } from '@/lib/pouriq/calculations'
import { CHIP, CHIP_IDLE, HELPER, INPUT, LABEL } from '@/lib/pouriq/ui'
import { SECONDARY_BUTTON_SM } from '@/lib/pouriq/button-styles'

interface Props {
  entry: IngredientLibraryRow
  uses: IngredientUseRow[]
}

export function IngredientUsesEditor({ entry, uses }: Props) {
  const router = useRouter()
  const [addName, setAddName] = useState('')
  const [addUnit, setAddUnit] = useState<'ml' | 'count' | 'g'>('count')
  const [addYield, setAddYield] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const perPurchaseUnitP = usableCostPerBaseUnitP(
    entry.price_p, entry.purchase_qty, entry.pack_size, entry.yield_pct,
  )

  const template = PRODUCE_LIBRARY.find(
    (t) => t.name.toLowerCase() === entry.name.toLowerCase(),
  )
  const existingNames = new Set(uses.map((u) => u.name.toLowerCase()))
  const suggestions = template
    ? template.uses.filter((u) => !existingNames.has(u.name.toLowerCase()))
    : []

  function commit(nextUses: Array<{ name: string; recipe_unit: 'ml' | 'count' | 'g'; yield_qty: number }>) {
    setError(null)
    startTransition(async () => {
      try {
        await saveIngredientUsesAction(entry.id, nextUses)
        router.refresh()
      } catch (e) {
        setError((e as Error).message || 'Could not save')
      }
    })
  }

  function handleAddUse() {
    const trimmedName = addName.trim()
    if (!trimmedName) { setError('Name is required'); return }
    const yieldQty = parseFloat(addYield)
    if (!Number.isFinite(yieldQty) || yieldQty <= 0) { setError('Yield must be greater than 0'); return }
    const nextUses = [
      ...uses.map((u) => ({ name: u.name, recipe_unit: u.recipe_unit, yield_qty: u.yield_qty })),
      { name: trimmedName, recipe_unit: addUnit, yield_qty: yieldQty },
    ]
    setAddName('')
    setAddYield('')
    commit(nextUses)
  }

  function handleRemoveUse(idx: number) {
    const nextUses = uses
      .filter((_, i) => i !== idx)
      .map((u) => ({ name: u.name, recipe_unit: u.recipe_unit, yield_qty: u.yield_qty }))
    commit(nextUses)
  }

  function handleAddSuggestion(u: { name: string; recipe_unit: 'ml' | 'count' | 'g'; yield_qty: number }) {
    const nextUses = [
      ...uses.map((v) => ({ name: v.name, recipe_unit: v.recipe_unit, yield_qty: v.yield_qty })),
      { name: u.name, recipe_unit: u.recipe_unit, yield_qty: u.yield_qty },
    ]
    commit(nextUses)
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200">
        <p className="text-sm font-medium text-slate-700">Uses</p>
      </div>
      <div className="px-4 py-4 space-y-4">
        <p className={HELPER}>
          Define how this ingredient is used in recipes. Each use has its own yield and costing unit.
        </p>

        {suggestions.length > 0 && (
          <div>
            <p className={LABEL}>Suggested uses</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((u) => (
                <button
                  key={u.name}
                  type="button"
                  disabled={pending}
                  onClick={() => handleAddSuggestion(u)}
                  className={`${CHIP} ${CHIP_IDLE}`}
                >
                  {u.name} ({u.yield_qty} {u.recipe_unit === 'count' ? 'per item' : `${u.recipe_unit} yield`})
                </button>
              ))}
            </div>
          </div>
        )}

        {uses.length > 0 && (
          <ul className="space-y-2">
            {uses.map((u, idx) => {
              const costP = lineCostFromUseP(perPurchaseUnitP, u.yield_qty, 1)
              const costStr = costP > 0
                ? ` · £${(costP / 100).toFixed(4)}/${u.recipe_unit === 'count' ? 'piece' : u.recipe_unit}`
                : ''
              return (
                <li key={u.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-900 font-medium">{u.name}</span>
                  <span className="text-slate-500 text-xs tabular-nums">
                    {u.yield_qty}{u.recipe_unit === 'count' ? '' : ` ${u.recipe_unit}`} per item{costStr}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleRemoveUse(idx)}
                    className="text-xs text-rose-600 hover:text-rose-700 underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="pt-2 border-t border-slate-200">
          <p className="text-sm font-medium text-slate-700 mb-3">Add a use</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Name</label>
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className={INPUT}
                placeholder="e.g. Juice"
              />
            </div>
            <div>
              <label className={LABEL}>Unit</label>
              <select
                value={addUnit}
                onChange={(e) => setAddUnit(e.target.value as 'ml' | 'count' | 'g')}
                className={INPUT}
              >
                <option value="count">count</option>
                <option value="ml">ml</option>
                <option value="g">g</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Yield per item</label>
              <input
                type="number"
                step="any"
                min="0.001"
                value={addYield}
                onChange={(e) => setAddYield(e.target.value)}
                className={INPUT}
                placeholder={addUnit === 'ml' ? 'e.g. 30' : 'e.g. 6'}
              />
              <p className={HELPER}>
                {addUnit === 'count'
                  ? 'How many portions from one item'
                  : `How many ${addUnit} one item yields`}
              </p>
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-rose-600 mt-2">{error}</p>}
          <button
            type="button"
            disabled={pending}
            onClick={handleAddUse}
            className={`mt-3 ${SECONDARY_BUTTON_SM}`}
          >
            {pending ? 'Saving...' : 'Add use'}
          </button>
        </div>
      </div>
    </div>
  )
}
