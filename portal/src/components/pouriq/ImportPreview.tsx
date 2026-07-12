'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { IngredientLibraryRow, IngredientType, ServeUnitRow } from '@/lib/pouriq/types'
import { IngredientMatchRow, type MatchRowState } from '@/components/pouriq/IngredientMatchRow'
import { singleContainmentMatch } from '@/lib/pouriq/match'
import { planBulkFill, groupKeyFor, type BulkFillRow } from '@/lib/pouriq/import-bulk-fill'
import type { ParsedMeasurement, RecognisedServeUnit } from '@/lib/pouriq/measurement-parse'
import { parsePackFormat } from '@/lib/pouriq/measures'
import { packDefaultForServe, serveToRecipeUnit, type ServeToken } from '@/lib/pouriq/serve-map'
import { PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'

const inputClass = 'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-emerald-500 focus:outline-hidden'

export interface PreviewDrinkInput {
  name: string
  sale_price_p: number | null
  ingredients: Array<{
    extracted_name: string
    base_product: string | null
    serve: ServeToken | null
    raw_measurement: string
    inferred_type: IngredientType
    parsed: ParsedMeasurement
    match:
      | { kind: 'auto'; library_id: string; library_name: string }
      | { kind: 'suggestions'; entries: Array<{ id: string; name: string }> }
      | { kind: 'catalogue'; catalogue_id: string; name: string; ingredient_type: IngredientType; base_unit: 'ml' | 'g' | 'each'; default_pack_size: number | null }
      | { kind: 'no-match' }
    /** Row added by the user during review, not extracted from the menu. */
    added?: boolean
  }>
}

// A staged new_library entry is only "resolved" once it carries a usable
// price — catalogue adoptions start price-less and must be filled in.
function newLibraryPriced(nl: NonNullable<MatchRowState['new_library']>): boolean {
  return nl.price_p !== null && nl.price_p > 0
}

function isRowResolved(s: MatchRowState): boolean {
  if (s.existing_library_id) return true
  if (s.new_library) return newLibraryPriced(s.new_library)
  return false
}

interface DrinkState {
  skip: boolean
  name: string
  salePoundsStr: string
  ingredients: MatchRowState[]
}

function serveUnitFromParsed(parsed: ParsedMeasurement): { recipe_unit: RecognisedServeUnit | null; recipe_qty: number | null } {
  if (!('pour_ml' in parsed) || parsed.pour_ml === undefined) return { recipe_unit: null, recipe_qty: null }
  return { recipe_unit: parsed.serve_unit ?? null, recipe_qty: parsed.serve_qty ?? null }
}

function initialIngredientState(input: PreviewDrinkInput['ingredients'][0], libraryEntries: IngredientLibraryRow[]): MatchRowState {
  // When the AI identified a serve token, prefer it for recipe serve + pour ml
  // (e.g. "pint" is more reliable than a raw ml measurement for draught lines).
  // Fall back to the parsed measurement (handles dash/barspoon/tsp).
  const serveDefaults = input.serve ? serveToRecipeUnit(input.serve) : null

  const pour_ml: number | null = serveDefaults
    ? serveDefaults.pour_ml
    : 'pour_ml' in input.parsed ? (input.parsed.pour_ml ?? null) : null
  const unit_count: number | null = serveDefaults
    ? null
    : ('unit_count' in input.parsed ? (input.parsed.unit_count ?? null) : null)

  // If the measurement named a recognised serve unit (dash/barspoon/tsp),
  // default recipe_unit/recipe_qty from the parse result so the picker starts
  // on the right unit without the user needing to adjust it.
  const parsedServe = serveUnitFromParsed(input.parsed)
  const recipe_unit: string | null = serveDefaults ? serveDefaults.recipe_unit : parsedServe.recipe_unit
  const recipe_qty: number | null = serveDefaults ? serveDefaults.recipe_qty : parsedServe.recipe_qty

  if (input.match.kind === 'auto') {
    return {
      existing_library_id: input.match.library_id,
      pour_ml,
      unit_count,
      recipe_unit,
      recipe_qty,
    }
  }
  if (input.match.kind === 'catalogue') {
    // Pre-stage a new library entry from the catalogue; the bar just types
    // the price. Starts price-less so it counts as "needs price" until filled.
    // When a serve token is present (e.g. pint/half_pint) use its pack default
    // (keg 50L) rather than the extracted name or catalogue fallback.
    const m = input.match
    const packFromServe = input.serve ? packDefaultForServe(input.serve) : null
    const pack = !packFromServe && m.base_unit === 'ml' ? parsePackFormat(input.extracted_name) : null
    return {
      new_library: {
        name: m.name,
        ingredient_type: m.ingredient_type,
        base_unit: m.base_unit,
        pack_size: packFromServe?.pack_size ?? pack?.pack_size ?? m.default_pack_size ?? (m.base_unit === 'each' ? 1 : 700),
        pack_format: packFromServe?.pack_format ?? null,
        price_p: null,
        price_includes_vat: false,
        purchase_qty: pack?.purchase_qty ?? 1,
      },
      pour_ml,
      unit_count,
      recipe_unit,
      recipe_qty,
    }
  }
  const preselect = singleContainmentMatch(input.extracted_name, libraryEntries)
  if (preselect) {
    return { existing_library_id: preselect.id, pour_ml, unit_count, recipe_unit, recipe_qty }
  }
  return { pour_ml, unit_count, recipe_unit, recipe_qty }
}

function initialDrinkState(d: PreviewDrinkInput, libraryEntries: IngredientLibraryRow[]): DrinkState {
  return {
    skip: false,
    name: d.name,
    salePoundsStr: d.sale_price_p !== null ? (d.sale_price_p / 100).toFixed(2) : '',
    ingredients: d.ingredients.map((ing) => initialIngredientState(ing, libraryEntries)),
  }
}

interface Props {
  menuId: string
  drinks: PreviewDrinkInput[]
  libraryEntries: IngredientLibraryRow[]
  serveUnits: Record<string, ServeUnitRow[]>
  truncated?: boolean
}

function AddIngredientInline({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <div className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { e.preventDefault(); onAdd(name.trim()); setName('') } }}
        className={inputClass}
        placeholder="Add an ingredient this drink is missing (e.g. Orange juice)"
        aria-label="Add ingredient name"
      />
      <button
        type="button"
        disabled={!name.trim()}
        onClick={() => { onAdd(name.trim()); setName('') }}
        className="shrink-0 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-600 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-40"
      >
        Add ingredient
      </button>
    </div>
  )
}

export function ImportPreview({ menuId, drinks: extracted, libraryEntries, serveUnits, truncated }: Props) {
  const router = useRouter()
  // The extracted drinks become state so rows can be added during review
  // (description-only drinks arrive with zero ingredients).
  const [sources, setSources] = useState<PreviewDrinkInput[]>(() => extracted.map((d) => ({ ...d, ingredients: [...d.ingredients] })))
  const [drinks, setDrinks] = useState<DrinkState[]>(() => extracted.map((d) => initialDrinkState(d, libraryEntries)))
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([0, 1, 2]))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const stats = drinks.reduce((acc, d) => {
    if (d.skip) return acc
    acc.included++
    for (const ing of d.ingredients) {
      if (ing.existing_library_id) acc.matched++
      else if (ing.new_library) {
        if (newLibraryPriced(ing.new_library)) acc.toCreate++
        else acc.needsChoice++
      }
      else acc.needsChoice++
    }
    return acc
  }, { included: 0, matched: 0, toCreate: 0, needsChoice: 0 })

  function toggle(idx: number) {
    setExpanded((set) => {
      const next = new Set(set)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  function updateDrink(idx: number, patch: Partial<DrinkState>) {
    setDrinks((arr) => arr.map((d, i) => i === idx ? { ...d, ...patch } : d))
  }

  function updateIngredient(drinkIdx: number, ingIdx: number, state: MatchRowState) {
    setDrinks((arr) => arr.map((d, i) => {
      if (i !== drinkIdx) return d
      return {
        ...d,
        ingredients: d.ingredients.map((ing, j) => j === ingIdx ? state : ing),
      }
    }))
  }

  // F14: let the reviewer complete a drink the menu described in prose. Both
  // the source row (for names/grouping) and the match state grow in step.
  function addIngredient(drinkIdx: number, name: string) {
    const preselect = singleContainmentMatch(name, libraryEntries)
    setSources((arr) => arr.map((d, i) => i !== drinkIdx ? d : {
      ...d,
      ingredients: [...d.ingredients, {
        extracted_name: name,
        base_product: null,
        serve: null,
        raw_measurement: 'added during review',
        inferred_type: 'other' as IngredientType,
        parsed: { raw: 'added during review' },
        match: { kind: 'no-match' as const },
        added: true,
      }],
    }))
    setDrinks((arr) => arr.map((d, i) => i !== drinkIdx ? d : {
      ...d,
      ingredients: [...d.ingredients, {
        existing_library_id: preselect?.id,
        pour_ml: null,
        unit_count: null,
        recipe_unit: null,
        recipe_qty: null,
      }],
    }))
  }

  function removeIngredient(drinkIdx: number, ingIdx: number) {
    setSources((arr) => arr.map((d, i) => i !== drinkIdx ? d : { ...d, ingredients: d.ingredients.filter((_, j) => j !== ingIdx) }))
    setDrinks((arr) => arr.map((d, i) => i !== drinkIdx ? d : { ...d, ingredients: d.ingredients.filter((_, j) => j !== ingIdx) }))
  }

  // F11a: staged new entries (priced, so picking one resolves the row) offered
  // as pick targets on other rows — "Gin" can resolve to the "Gordon's" being
  // created three drinks up. Commit dedupes staged entries by name.
  const stagedEntries = (() => {
    const map = new Map<string, { name: string; ingredient_type: IngredientType; new_library: NonNullable<MatchRowState['new_library']> }>()
    drinks.forEach((d) => {
      if (d.skip) return
      d.ingredients.forEach((st) => {
        if (st.new_library && newLibraryPriced(st.new_library)) {
          const k = st.new_library.name.trim().toLowerCase()
          if (k && !map.has(k)) map.set(k, { name: st.new_library.name, ingredient_type: st.new_library.ingredient_type, new_library: st.new_library })
        }
      })
    })
    return [...map.values()]
  })()

  function pickStaged(drinkIdx: number, ingIdx: number, stagedName: string) {
    const staged = stagedEntries.find((s) => s.name === stagedName)
    if (!staged) return
    setDrinks((arr) => arr.map((d, i) => i !== drinkIdx ? d : {
      ...d,
      ingredients: d.ingredients.map((st, j) => j !== ingIdx ? st : {
        ...st,
        existing_library_id: undefined,
        new_library: { ...staged.new_library },
        bulk_filled_from: staged.name,
      }),
    }))
  }

  // When a row resolves, auto-fill every other still-unresolved row for the
  // same ingredient (price/library copied; each drink keeps its own pour/unit).
  // Functional updater so it reads the just-resolved state, not a stale closure.
  function propagateFrom(drinkIdx: number, ingIdx: number) {
    setDrinks((arr) => {
      const flat: BulkFillRow[] = []
      const coords: Array<{ d: number; i: number }> = []
      arr.forEach((d, di) => {
        if (d.skip) return
        d.ingredients.forEach((st, ii) => {
          flat.push({
            groupKey: groupKeyFor(sources[di].ingredients[ii]),
            resolved: isRowResolved(st),
            state: st,
          })
          coords.push({ d: di, i: ii })
        })
      })
      const sourcePos = coords.findIndex((c) => c.d === drinkIdx && c.i === ingIdx)
      if (sourcePos < 0) return arr
      const plan = planBulkFill(flat, sourcePos)
      if (!plan) return arr
      // Derive the display name for the "Priced via" indicator on target rows.
      const sourceState = arr[drinkIdx].ingredients[ingIdx]
      const sourceName: string =
        sourceState.new_library?.name
        ?? libraryEntries.find((e) => e.id === sourceState.existing_library_id)?.name
        ?? sources[drinkIdx].ingredients[ingIdx].base_product
        ?? sources[drinkIdx].ingredients[ingIdx].extracted_name
      const next = arr.map((d) => ({ ...d, ingredients: d.ingredients.slice() }))
      for (const t of plan.targets) {
        const { d, i } = coords[t]
        const target = next[d].ingredients[i]
        next[d].ingredients[i] = {
          ...target,
          existing_library_id: plan.apply.existing_library_id,
          new_library: plan.apply.new_library ? { ...plan.apply.new_library } : undefined,
          bulk_filled_from: sourceName,
        }
      }
      return next
    })
  }

  // Step through the rows still needing a library choice/price: expand the
  // drink that holds the next one and scroll it into view. Saves slow-scrolling
  // a long list hunting for what's left. Cycles back to the first when it runs off the end.
  const lastJumpRef = useRef(-1)
  function jumpToNextUnresolved() {
    const coords: Array<{ d: number; i: number }> = []
    drinks.forEach((d, di) => {
      if (d.skip) return
      d.ingredients.forEach((st, ii) => { if (!isRowResolved(st)) coords.push({ d: di, i: ii }) })
    })
    if (coords.length === 0) return
    lastJumpRef.current = (lastJumpRef.current + 1) % coords.length
    const { d, i } = coords[lastJumpRef.current]
    setExpanded((set) => new Set(set).add(d))
    // Let the expand re-render before scrolling to the row.
    setTimeout(() => {
      document.getElementById(`import-ing-${d}-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
  }

  async function handleCommit() {
    setError(null)
    if (stats.needsChoice > 0) {
      setError(`${stats.needsChoice} ingredients still need a library match or a price`)
      return
    }
    if (stats.included === 0) {
      setError('No drinks selected for import')
      return
    }

    // Validation: every included drink needs a name + sale price > 0;
    // every kept ingredient needs pour_ml or unit_count > 0.
    for (let i = 0; i < drinks.length; i++) {
      const d = drinks[i]
      if (d.skip) continue
      if (!d.name.trim()) { setError(`Drink ${i + 1} needs a name`); return }
      const sale_price_p = Math.round(parseFloat(d.salePoundsStr) * 100)
      if (!Number.isFinite(sale_price_p) || sale_price_p <= 0) { setError(`${d.name}: needs a sale price`); return }
      for (let j = 0; j < d.ingredients.length; j++) {
        const ing = d.ingredients[j]
        if (!ing.existing_library_id && !ing.new_library) { setError(`${d.name} ingredient ${j + 1} unresolved`); return }
        const hasQty = (ing.pour_ml !== null && ing.pour_ml > 0) || (ing.unit_count !== null && ing.unit_count > 0)
        if (!hasQty) { setError(`${d.name} ingredient ${j + 1} needs a pour or unit count`); return }
      }
    }

    const body = {
      menuId,
      drinks: drinks
        .filter((d) => !d.skip)
        .map((d) => ({
          name: d.name.trim(),
          sale_price_p: Math.round(parseFloat(d.salePoundsStr) * 100),
          ingredients: d.ingredients.map((ing) => ({
            existing_library_id: ing.existing_library_id,
            new_library: ing.new_library,
            pour_ml: ing.pour_ml,
            unit_count: ing.unit_count,
            recipe_unit: ing.recipe_unit,
            recipe_qty: ing.recipe_qty,
          })),
        })),
    }

    setSubmitting(true)
    const res = await fetch('/api/pouriq/import/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Commit failed' })) as { error?: string }
      setError(data.error ?? 'Commit failed')
      setSubmitting(false)
      return
    }
    router.push(`/${menuId}`)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-2 z-20 bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            <strong className="text-emerald-700">{stats.included}</strong> drinks ·{' '}
            <strong className="text-emerald-600">{stats.matched}</strong> auto-matched ·{' '}
            <strong className="text-amber-600">{stats.toCreate}</strong> new library entries ·{' '}
            {stats.needsChoice > 0
              ? <strong className="text-rose-600">{stats.needsChoice} need a choice</strong>
              : <strong className="text-emerald-600">all resolved</strong>}
          </p>
          {stats.needsChoice > 0 && (
            <button
              type="button"
              onClick={jumpToNextUnresolved}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-600 text-emerald-700 text-xs font-semibold hover:bg-emerald-100"
            >
              Jump to next unresolved →
            </button>
          )}
        </div>
      </div>

      {truncated && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This menu was long and extraction may be incomplete. Check the last drinks against the original before importing.
        </div>
      )}

      <div className="space-y-4">
        {drinks.map((d, idx) => (
          <div key={idx} className={`border rounded-xl ${d.skip ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>
            <button type="button" onClick={() => toggle(idx)} aria-expanded={expanded.has(idx)} aria-controls={`drink-panel-${idx}`} className="w-full text-left p-4 flex items-baseline justify-between gap-3">
              <h3 className={`text-base font-bold ${d.skip ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                {d.name}
              </h3>
              <span className="text-xs text-slate-500">{expanded.has(idx) ? 'Hide' : 'Show'} ({d.ingredients.length} ing.)</span>
            </button>
            {expanded.has(idx) && (
              <div id={`drink-panel-${idx}`} className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                    <input value={d.name} onChange={(e) => updateDrink(idx, { name: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Sale price (£)</label>
                    <input type="number" step="0.01" min={0} value={d.salePoundsStr} onChange={(e) => updateDrink(idx, { salePoundsStr: e.target.value })} className={inputClass} placeholder="0.00" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={d.skip} onChange={(e) => updateDrink(idx, { skip: e.target.checked })} className="w-4 h-4 accent-emerald-600" />
                  Skip this drink
                </label>
                {!d.skip && d.ingredients.map((_ingState, ingIdx) => {
                  const ing = sources[idx].ingredients[ingIdx]
                  const ingState = d.ingredients[ingIdx]
                  const gk = groupKeyFor(ing)

                  // Count how many other drink rows in the same group were bulk-filled
                  // from this row (making it the pricing source).
                  let sharedWithCount = 0
                  if (gk !== null && !ingState.bulk_filled_from) {
                    drinks.forEach((dk, di) => {
                      if (dk.skip) return
                      dk.ingredients.forEach((st, ii) => {
                        if (di === idx && ii === ingIdx) return
                        if (st.bulk_filled_from && groupKeyFor(sources[di].ingredients[ii]) === gk) {
                          sharedWithCount++
                        }
                      })
                    })
                  }

                  return (
                  <div key={ingIdx} id={`import-ing-${idx}-${ingIdx}`} className="scroll-mt-24">
                    <IngredientMatchRow
                      extractedName={ing.extracted_name}
                      rawMeasurement={ing.raw_measurement}
                      inferredType={ing.inferred_type}
                      matchKind={ing.match.kind}
                      libraryEntries={libraryEntries}
                      serveUnits={serveUnits}
                      state={ingState}
                      onChange={(state) => updateIngredient(idx, ingIdx, state)}
                      onResolvedCommit={() => propagateFrom(idx, ingIdx)}
                      sharedWithCount={sharedWithCount > 0 ? sharedWithCount : undefined}
                      stagedEntries={stagedEntries}
                      onPickStaged={(name) => pickStaged(idx, ingIdx, name)}
                    />
                    {ing.added && (
                      <button
                        type="button"
                        onClick={() => removeIngredient(idx, ingIdx)}
                        className="mt-1 text-xs text-slate-500 hover:text-rose-600"
                      >
                        Remove this added ingredient
                      </button>
                    )}
                  </div>
                  )
                })}
                {!d.skip && (
                  <AddIngredientInline onAdd={(name) => addIngredient(idx, name)} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

      <div className="flex justify-end">
        <button type="button" onClick={handleCommit} disabled={submitting || stats.needsChoice > 0 || stats.included === 0}
          className={PRIMARY_BUTTON}>
          {submitting ? 'Importing…' : `Import ${stats.included} drink${stats.included === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  )
}
