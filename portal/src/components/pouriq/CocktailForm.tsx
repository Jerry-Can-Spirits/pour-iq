'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveCocktailAction, deleteCocktailAction, removeCocktailPhotoAction } from '@/lib/pouriq/server-actions'
import { IngredientPicker } from '@/components/pouriq/IngredientPicker'
import { ServeUnitPicker } from '@/components/pouriq/ServeUnitPicker'
import type { CocktailWithIngredients, IngredientLibraryRow, ServeUnitRow, ItemType, IngredientUseRow } from '@/lib/pouriq/types'
import { ITEM_TYPES } from '@/lib/pouriq/types'
import { GLASS_OPTIONS } from '@/lib/pouriq/measures'
import type { ServeUnit } from '@/lib/pouriq/measures'
import { INPUT, SELECT, LABEL, CHIP, CHIP_ACTIVE, CHIP_IDLE, HELPER } from '@/lib/pouriq/ui'
import { lineCostFromUseP, usableCostPerBaseUnitP } from '@/lib/pouriq/calculations'
import { PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'

interface FormIngredient {
  library_entry: IngredientLibraryRow | null
  pour_ml: number | null
  unit_count: number | null
  recipe_unit: string | null
  recipe_qty: number | null
  use_id: string | null
}

function ingredientRowToForm(row: CocktailWithIngredients['ingredients'][0]): FormIngredient {
  return {
    library_entry: row.library,
    pour_ml: row.pour_ml,
    unit_count: row.unit_count,
    recipe_unit: row.recipe_unit,
    recipe_qty: row.recipe_qty,
    use_id: row.use_id,
  }
}

function blankIngredient(): FormIngredient {
  return { library_entry: null, pour_ml: null, unit_count: null, recipe_unit: null, recipe_qty: null, use_id: null }
}

interface Props {
  menuId: string
  cocktail: CocktailWithIngredients | null
  libraryEntries: IngredientLibraryRow[]
  serveUnits: Record<string, ServeUnitRow[]>
  ingredientUses: Record<string, IngredientUseRow[]>
}

export function CocktailForm({ menuId, cocktail, libraryEntries, serveUnits, ingredientUses }: Props) {
  const router = useRouter()
  const [name, setName] = useState(cocktail?.name ?? '')
  const [salePricePounds, setSalePricePounds] = useState(
    cocktail ? (cocktail.sale_price_p / 100).toFixed(2) : ''
  )
  const [promoPricePounds, setPromoPricePounds] = useState(
    cocktail?.promotional_price_p !== null && cocktail?.promotional_price_p !== undefined
      ? (cocktail.promotional_price_p / 100).toFixed(2) : ''
  )
  const [promoLabel, setPromoLabel] = useState(cocktail?.promotional_label ?? '')
  const [promoDays, setPromoDays] = useState<number[]>(
    cocktail?.promotional_days
      ? cocktail.promotional_days.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
      : []
  )
  const [promoValidFrom, setPromoValidFrom] = useState(cocktail?.promotional_valid_from ?? '')
  const [promoValidUntil, setPromoValidUntil] = useState(cocktail?.promotional_valid_until ?? '')
  const [promoStartTime, setPromoStartTime] = useState(cocktail?.promotional_start_time ?? '')
  const [promoEndTime, setPromoEndTime] = useState(cocktail?.promotional_end_time ?? '')
  const [notes, setNotes] = useState(cocktail?.notes ?? '')
  const [glass, setGlass] = useState(cocktail?.glass ?? '')
  const [itemType, setItemType] = useState<ItemType>(cocktail?.item_type ?? 'cocktail')
  const [ingredients, setIngredients] = useState<FormIngredient[]>(
    cocktail?.ingredients.length
      ? cocktail.ingredients.map(ingredientRowToForm)
      : [blankIngredient()]
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [photoHasImage, setPhotoHasImage] = useState(cocktail?.photo_r2_key !== null && cocktail?.photo_r2_key !== undefined)
  const [photoVersion, setPhotoVersion] = useState(0)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoUploading, startPhotoTransition] = useTransition()
  const [removingPhoto, setRemovingPhoto] = useState(false)

  function handlePhotoUpload(file: File) {
    if (!cocktail) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('target', 'drink-photo')
    fd.append('id', cocktail.id)
    setPhotoError(null)
    startPhotoTransition(async () => {
      try {
        const res = await fetch('/api/pouriq/images/upload', { method: 'POST', body: fd })
        if (!res.ok) { setPhotoError('Could not upload photo'); return }
        setPhotoHasImage(true)
        setPhotoVersion((v) => v + 1)
      } catch {
        setPhotoError('Could not upload photo')
      }
    })
  }

  async function handleRemovePhoto() {
    if (!cocktail || removingPhoto) return
    setRemovingPhoto(true)
    setPhotoError(null)
    try {
      await removeCocktailPhotoAction(menuId, cocktail.id)
      setPhotoHasImage(false)
    } catch {
      setPhotoError('Could not remove photo')
    } finally {
      setRemovingPhoto(false)
    }
  }

  function updateIngredient(idx: number, patch: Partial<FormIngredient>) {
    setIngredients((arr) => arr.map((ing, i) => i === idx ? { ...ing, ...patch } : ing))
  }

  function addIngredient() {
    setIngredients((arr) => [...arr, blankIngredient()])
  }

  function removeIngredient(idx: number) {
    setIngredients((arr) => arr.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const sale_price_p = Math.round(Number(salePricePounds) * 100)
    if (!name.trim()) { setError('Drink name is required'); return }
    if (!Number.isFinite(sale_price_p) || sale_price_p <= 0) { setError('Sale price must be > 0'); return }

    const parsed: Array<{ library_ingredient_id: string; pour_ml: number | null; unit_count: number | null; recipe_unit: string | null; recipe_qty: number | null; use_id: string | null }> = []
    for (let idx = 0; idx < ingredients.length; idx++) {
      const ing = ingredients[idx]
      if (!ing.library_entry) {
        setError(`Ingredient ${idx + 1}: pick an ingredient or remove the row`)
        return
      }
      const entryUses = ingredientUses[ing.library_entry.id] ?? []
      if (entryUses.length > 0) {
        // Use-based row: require a use selection and a positive amount
        if (!ing.use_id) {
          setError(`Ingredient ${idx + 1} ("${ing.library_entry.name}"): select a use`)
          return
        }
        if (ing.recipe_qty === null || ing.recipe_qty <= 0) {
          setError(`Ingredient ${idx + 1} ("${ing.library_entry.name}"): amount must be > 0`)
          return
        }
        const selectedUse = entryUses.find((u) => u.id === ing.use_id)
        parsed.push({
          library_ingredient_id: ing.library_entry.id,
          pour_ml: null,
          unit_count: null,
          recipe_unit: selectedUse?.recipe_unit ?? ing.recipe_unit,
          recipe_qty: ing.recipe_qty,
          use_id: ing.use_id,
        })
      } else {
        // No uses: original validation (unchanged)
        const baseUnit = ing.library_entry.base_unit
        if (baseUnit === 'each') {
          if (ing.unit_count === null || ing.unit_count <= 0) {
            setError(`Ingredient ${idx + 1} ("${ing.library_entry.name}"): quantity must be > 0`)
            return
          }
        } else {
          if (ing.pour_ml === null || ing.pour_ml <= 0) {
            setError(`Ingredient ${idx + 1} ("${ing.library_entry.name}"): amount must be > 0`)
            return
          }
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
    }

    if (parsed.length === 0) { setError('Add at least one ingredient'); return }

    let promotional_price_p: number | null = null
    const promoTrimmed = promoPricePounds.trim()
    if (promoTrimmed) {
      promotional_price_p = Math.round(Number(promoTrimmed) * 100)
      if (!Number.isFinite(promotional_price_p) || promotional_price_p <= 0) {
        setError('Promo price must be > 0 if set')
        return
      }
      if (promotional_price_p >= sale_price_p) {
        setError('Promo price should be lower than the normal sale price')
        return
      }
    }
    const promotional_label = promoLabel.trim() || null

    let promotional_days: string | null = null
    let promotional_valid_from: string | null = null
    let promotional_valid_until: string | null = null
    let promotional_start_time: string | null = null
    let promotional_end_time: string | null = null
    if (promotional_price_p !== null) {
      if (promoDays.length > 0 && promoDays.length < 7) {
        promotional_days = [...promoDays].sort((a, b) => a - b).join(',')
      }
      const isoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim()) ? s.trim() : null
      promotional_valid_from = isoDate(promoValidFrom)
      promotional_valid_until = isoDate(promoValidUntil)
      if (promotional_valid_from && promotional_valid_until && promotional_valid_until < promotional_valid_from) {
        setError('Promo end date must be on or after the start date')
        return
      }
      const hhmm = (s: string) => /^\d{2}:\d{2}$/.test(s.trim()) ? s.trim() : null
      promotional_start_time = hhmm(promoStartTime)
      promotional_end_time = hhmm(promoEndTime)
      if (promotional_start_time && promotional_end_time && promotional_end_time <= promotional_start_time) {
        setError('Promo end time must be after the start time.')
        return
      }
    }

    setSubmitting(true)
    try {
      await saveCocktailAction(menuId, cocktail?.id ?? null, {
        name: name.trim(),
        sale_price_p,
        promotional_price_p,
        promotional_label,
        promotional_days,
        promotional_valid_from,
        promotional_valid_until,
        promotional_start_time,
        promotional_end_time,
        notes: notes.trim() || null,
        glass: glass.trim() || null,
        item_type: itemType,
        ingredients: parsed,
      })
      router.push(`/${menuId}`)
      router.refresh()
    } catch (e) {
      setError((e as Error).message || 'Could not save')
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!cocktail) return
    if (!confirm(`Delete "${cocktail.name}"?`)) return
    await deleteCocktailAction(menuId, cocktail.id)
    router.push(`/${menuId}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="cocktail_name" className={LABEL}>Drink name *</label>
          <input id="cocktail_name" required value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label htmlFor="sale_price" className={LABEL}>Sale price (£) *</label>
          <input id="sale_price" type="number" step="0.01" min={0} required value={salePricePounds} onChange={(e) => setSalePricePounds(e.target.value)} className={INPUT} />
        </div>
      </div>

      <div className="sm:w-1/2 sm:pr-2">
        <label htmlFor="item_type" className={LABEL}>Drink type</label>
        <select
          id="item_type"
          value={itemType}
          onChange={(e) => setItemType(e.target.value as ItemType)}
          className={SELECT}
        >
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace('-', ' ')}</option>
          ))}
        </select>
      </div>

      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <h3 className="text-sm font-medium text-slate-900">Promotional price (optional)</h3>
        <p className="text-xs text-slate-500 mt-1 mb-3">
          Set a promo price for happy hour, 2-4-1, or any period when this drink sells for less. Leave blank if there&rsquo;s no promo.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="promo_price" className={LABEL}>Promo price (£)</label>
            <input id="promo_price" type="number" step="0.01" min={0} value={promoPricePounds} onChange={(e) => setPromoPricePounds(e.target.value)} className={INPUT} placeholder="leave blank for none" />
          </div>
          <div>
            <label htmlFor="promo_label" className={LABEL}>Label</label>
            <input id="promo_label" value={promoLabel} onChange={(e) => setPromoLabel(e.target.value)} className={INPUT} placeholder="e.g. Happy hour, 2-4-1" />
          </div>
        </div>
        {promoPricePounds.trim() !== '' && (
          <>
            <div className="mt-4">
              <label className={LABEL}>Active on (leave none selected for every day)</label>
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
                  const active = promoDays.includes(d.value)
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setPromoDays((arr) => active ? arr.filter((n) => n !== d.value) : [...arr, d.value])}
                      className={`${CHIP} ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label htmlFor="promo_valid_from" className={LABEL}>Valid from (optional)</label>
                <input id="promo_valid_from" type="date" value={promoValidFrom} onChange={(e) => setPromoValidFrom(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label htmlFor="promo_valid_until" className={LABEL}>Valid until (optional)</label>
                <input id="promo_valid_until" type="date" value={promoValidUntil} onChange={(e) => setPromoValidUntil(e.target.value)} className={INPUT} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label htmlFor="promo_start_time" className={LABEL}>Start time (optional)</label>
                <input id="promo_start_time" type="time" value={promoStartTime} onChange={(e) => setPromoStartTime(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label htmlFor="promo_end_time" className={LABEL}>End time (optional)</label>
                <input id="promo_end_time" type="time" value={promoEndTime} onChange={(e) => setPromoEndTime(e.target.value)} className={INPUT} />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <h3 className="text-sm font-medium text-slate-900 mb-4">Ingredients</h3>
        <div className="space-y-4">
          {ingredients.map((ing, idx) => {
            const entry = ing.library_entry
            const customUnits: ServeUnit[] = entry ? (serveUnits[entry.id] ?? []) : []
            const uses: IngredientUseRow[] = entry ? (ingredientUses[entry.id] ?? []) : []
            const hasUses = uses.length > 0
            const selectedUse = hasUses ? (uses.find((u) => u.id === ing.use_id) ?? null) : null
            const perPurchaseUnitP = entry && hasUses && selectedUse
              ? usableCostPerBaseUnitP(entry.price_p, entry.purchase_qty, entry.pack_size, entry.yield_pct)
              : 0
            const costP = selectedUse && ing.recipe_qty !== null && ing.recipe_qty > 0
              ? lineCostFromUseP(perPurchaseUnitP, selectedUse.yield_qty, ing.recipe_qty)
              : null

            return (
              <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <label className={LABEL}>Ingredient {idx + 1}</label>
                <IngredientPicker
                  libraryEntries={libraryEntries}
                  selectedEntryId={ing.library_entry?.id ?? null}
                  onChange={(newEntry) => updateIngredient(idx, {
                    library_entry: newEntry,
                    pour_ml: null,
                    unit_count: null,
                    recipe_unit: null,
                    recipe_qty: null,
                    use_id: null,
                  })}
                />

                {entry && hasUses && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className={LABEL}>Use</label>
                      <select
                        value={ing.use_id ?? ''}
                        onChange={(e) => {
                          const newUseId = e.target.value || null
                          const newUse = uses.find((u) => u.id === newUseId) ?? null
                          updateIngredient(idx, {
                            use_id: newUseId,
                            recipe_unit: newUse?.recipe_unit ?? null,
                            recipe_qty: null,
                            pour_ml: null,
                            unit_count: null,
                          })
                        }}
                        className={INPUT}
                      >
                        <option value="">Select a use</option>
                        {uses.map((u) => (
                          <option key={u.id} value={u.id}>{u.name} ({u.recipe_unit})</option>
                        ))}
                      </select>
                    </div>
                    {selectedUse && (
                      <div>
                        <label className={LABEL}>Amount ({selectedUse.recipe_unit})</label>
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          value={ing.recipe_qty ?? ''}
                          onChange={(e) => {
                            const n = parseFloat(e.target.value)
                            updateIngredient(idx, { recipe_qty: Number.isFinite(n) && n > 0 ? n : null })
                          }}
                          className={INPUT}
                          placeholder={selectedUse.recipe_unit === 'ml' ? 'e.g. 25' : 'e.g. 1'}
                        />
                        {costP !== null && (
                          <p className={`${HELPER} text-emerald-700`}>
                            £{(costP / 100).toFixed(3)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {entry && !hasUses && (
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
                  <button type="button" onClick={() => removeIngredient(idx)} className="mt-3 text-xs text-slate-500 hover:text-rose-600 underline">
                    Remove ingredient
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <button type="button" onClick={addIngredient} className="mt-4 text-sm text-emerald-700 hover:text-emerald-600 underline">
          Add another ingredient
        </button>
      </div>

      <div>
        <label htmlFor="glass" className={LABEL}>Glass</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {GLASS_OPTIONS.map((g) => (
            <button type="button" key={g} onClick={() => setGlass(g)}
              className={`${CHIP} ${glass === g ? CHIP_ACTIVE : CHIP_IDLE}`}>
              {g}
            </button>
          ))}
        </div>
        <input id="glass" value={glass} onChange={(e) => setGlass(e.target.value)} className={INPUT} placeholder="e.g. Rocks, Highball" />
      </div>

      <div>
        <label htmlFor="notes" className={LABEL}>Directions</label>
        <p className="text-xs text-slate-500 mb-1">Your method for this drink (build, glass, technique). Shown to staff on the spec card.</p>
        <textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${INPUT} resize-vertical`} placeholder="e.g. Build over cubed ice, stir, lemon twist." />
      </div>

      {cocktail && (
        <div className="border border-slate-200 rounded-lg p-4 bg-white">
          <h3 className="text-sm font-medium text-slate-900 mb-1">Drink photo</h3>
          <p className="text-xs text-slate-500 mb-3">
            Appears on the printed menu and spec cards when photos are turned on.
            Add a photo after saving the drink for the first time.
          </p>
          {photoHasImage && (
            <img
              src={`/api/pouriq/cocktails/${cocktail.id}/photo?v=${photoVersion > 0 ? photoVersion : encodeURIComponent(cocktail.updated_at)}`}
              alt=""
              className="mb-3 w-24 h-24 object-cover rounded-lg border border-slate-200"
            />
          )}
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer text-xs text-emerald-700 hover:text-emerald-800 underline">
              {photoHasImage ? 'Replace photo' : 'Add photo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={photoUploading || removingPhoto}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handlePhotoUpload(f)
                  e.target.value = ''
                }}
              />
            </label>
            {photoHasImage && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={photoUploading || removingPhoto}
                className="text-xs text-rose-600 hover:text-rose-700 underline disabled:opacity-50"
              >
                {removingPhoto ? 'Removing...' : 'Remove photo'}
              </button>
            )}
          </div>
          {photoError && <p className="text-xs text-rose-600 mt-2">{photoError}</p>}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

      <div className="flex justify-between items-center">
        {cocktail ? (
          <button type="button" onClick={handleDelete} className="text-sm text-rose-600 hover:text-rose-700 underline">
            Delete drink
          </button>
        ) : <span />}
        <button type="submit" disabled={submitting} className={PRIMARY_BUTTON}>
          {submitting ? 'Saving…' : cocktail ? 'Save changes' : 'Add drink'}
        </button>
      </div>
    </form>
  )
}
