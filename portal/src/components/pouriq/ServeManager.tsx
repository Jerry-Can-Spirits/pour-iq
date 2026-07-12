'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PRIMARY_BUTTON, SECONDARY_BUTTON_SM, DESTRUCTIVE_BUTTON } from '@/lib/pouriq/button-styles'
import { formatServeMeasure } from '@/lib/pouriq/measures'
import { ServeForm, type ServeFormIngredient } from '@/components/pouriq/ServeForm'
import { saveServeAction, deleteServeAction } from '@/lib/pouriq/server-actions'
import { serveGp, usableCostPerBaseUnitP } from '@/lib/pouriq/calculations'
import type { CocktailWithIngredients, IngredientLibraryRow, IngredientWithLibrary, ServeUnitRow } from '@/lib/pouriq/types'

interface Props {
  serves: CocktailWithIngredients[]
  libraryEntries: IngredientLibraryRow[]
  serveUnits: Record<string, ServeUnitRow[]>
}

function formatPour(ing: IngredientWithLibrary): string {
  return formatServeMeasure(ing.recipe_unit, ing.recipe_qty, ing.pour_ml, ing.unit_count)
}

function toFormIngredients(serve: CocktailWithIngredients): ServeFormIngredient[] {
  return serve.ingredients.map((ing) => ({
    library_ingredient_id: ing.library_ingredient_id,
    pour_ml: ing.pour_ml,
    unit_count: ing.unit_count,
    recipe_unit: ing.recipe_unit,
    recipe_qty: ing.recipe_qty,
    use_id: ing.use_id,
  }))
}

export function ServeManager({ serves, libraryEntries, serveUnits }: Props) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save(serveId: string | null, name: string, glass: string | null, ingredients: ServeFormIngredient[], salePriceP: number) {
    setError(null)
    startTransition(async () => {
      try {
        await saveServeAction(serveId, { name, glass, sale_price_p: salePriceP, ingredients })
        setCreating(false)
        setEditingId(null)
        router.refresh()
      } catch (e) {
        setError((e as Error).message || 'Could not save the serve.')
      }
    })
  }

  function remove(serveId: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setError(null)
    startTransition(async () => {
      try {
        await deleteServeAction(serveId)
        router.refresh()
      } catch (e) {
        setError((e as Error).message || 'Could not delete the serve.')
      }
    })
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

      {!creating && (
        <button type="button" onClick={() => { setEditingId(null); setCreating(true) }} disabled={pending} className={PRIMARY_BUTTON}>
          Add serve
        </button>
      )}

      {creating && (
        <ServeForm
          defaultName=""
          libraryEntries={libraryEntries}
          serveUnits={serveUnits}
          pending={pending}
          submitLabel="Create serve"
          onError={setError}
          onSubmit={(name, glass, ingredients, salePriceP) => save(null, name, glass, ingredients, salePriceP)}
        />
      )}

      {serves.length === 0 && !creating ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-700 font-medium mb-1">No serves yet.</p>
          <p className="text-slate-500 text-sm">Add a serve so non-cocktail POS sales deplete stock.</p>
        </div>
      ) : (
        serves.map((serve) => (
          <div key={serve.id} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h2 className="text-lg font-bold text-slate-900">{serve.name}</h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setCreating(false); setEditingId((id) => id === serve.id ? null : serve.id) }} disabled={pending} className={SECONDARY_BUTTON_SM}>
                  {editingId === serve.id ? 'Cancel edit' : 'Edit'}
                </button>
                <button type="button" onClick={() => remove(serve.id, serve.name)} disabled={pending} className={DESTRUCTIVE_BUTTON}>
                  Delete
                </button>
              </div>
            </div>

            {serve.glass != null && serve.glass.trim() !== '' && (
              <p className="text-sm text-slate-600 mb-2">
                <span className="font-semibold">Glass:</span> {serve.glass}
              </p>
            )}

            {serve.sale_price_p > 0 && (
              <p className="text-sm text-slate-600 mb-2">
                <span className="font-semibold">Price:</span> £{(serve.sale_price_p / 100).toFixed(2)}
                {serve.ingredients.length === 1 && serve.ingredients[0].pour_ml != null && (() => {
                  const ing = serve.ingredients[0]
                  const lib = ing.library
                  const costPerMl = usableCostPerBaseUnitP(lib.price_p, lib.purchase_qty, lib.pack_size, lib.yield_pct)
                  const gp = serveGp({ costPerMlNetP: costPerMl, pourMl: ing.pour_ml!, salePriceP: serve.sale_price_p, pricesIncludeVat: false })
                  return gp !== null ? <span className="ml-2 text-emerald-700 font-medium">GP {gp.toFixed(1)}%</span> : null
                })()}
              </p>
            )}

            {serve.ingredients.length === 0 ? (
              <p className="text-slate-500 text-sm">No ingredients set.</p>
            ) : (
              <ul className="space-y-1">
                {serve.ingredients.map((ing) => (
                  <li key={ing.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-slate-900">{ing.library.name}</span>
                    <span className="text-slate-500 shrink-0">{formatPour(ing)}</span>
                  </li>
                ))}
              </ul>
            )}

            {editingId === serve.id && (
              <ServeForm
                defaultName={serve.name}
                defaultGlass={serve.glass}
                defaultSalePriceP={serve.sale_price_p}
                defaultIngredients={toFormIngredients(serve)}
                libraryEntries={libraryEntries}
                serveUnits={serveUnits}
                pending={pending}
                submitLabel="Save serve"
                onError={setError}
                onSubmit={(name, glass, ingredients, salePriceP) => save(serve.id, name, glass, ingredients, salePriceP)}
              />
            )}
          </div>
        ))
      )}
    </div>
  )
}
