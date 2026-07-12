'use client'

import { useState } from 'react'
import type { CocktailWithIngredients, ItemType } from '@/lib/pouriq/types'
import { ITEM_TYPES } from '@/lib/pouriq/types'
import { isAlcoholicType } from '@/lib/pouriq/abv'
import { SpecCard } from './SpecCard'
import { PrintReportButton } from './PrintReportButton'
import { PRIMARY_BUTTON, SECONDARY_BUTTON_SM } from '@/lib/pouriq/button-styles'
import { CHIP, CHIP_ACTIVE, CHIP_IDLE } from '@/lib/pouriq/ui'

interface Props {
  cocktails: CocktailWithIngredients[]
  costById: Record<string, { pourCostP: number; gpPct: number; complete: boolean }>
  priceIncludesVat: boolean
}

function labelForType(t: ItemType): string {
  return t.charAt(0).toUpperCase() + t.slice(1).replace('-', ' ')
}

export function SpecCardsView({ cocktails, costById, priceIncludesVat }: Props) {
  const [compact, setCompact] = useState(false)
  const [showCost, setShowCost] = useState(false)
  const [showPhotos, setShowPhotos] = useState(cocktails.some((c) => c.photo_r2_key !== null))
  const [showAllergens, setShowAllergens] = useState(() =>
    cocktails.some((c) =>
      c.ingredients.some(
        (i) =>
          i.library.allergens_reviewed === 1 ||
          i.library.allergens !== '[]' ||
          i.library.dietary !== '[]',
      ),
    ),
  )
  const [showAbv, setShowAbv] = useState(() =>
    cocktails.some((c) => c.ingredients.some((i) => isAlcoholicType(i.library.ingredient_type))),
  )
  const [selected, setSelected] = useState<Set<ItemType>>(new Set(['cocktail']))

  const present = ITEM_TYPES.filter((t) => cocktails.some((c) => c.item_type === t))
  const visible = cocktails.filter((c) => selected.has(c.item_type))

  function toggleType(t: ItemType) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(t)) { next.delete(t) } else { next.add(t) }
      return next
    })
  }

  return (
    <>
      <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-slate-500">Layout</span>
          <button type="button" aria-pressed={!compact} onClick={() => setCompact(false)} className={compact ? SECONDARY_BUTTON_SM : PRIMARY_BUTTON}>One per page</button>
          <button type="button" aria-pressed={compact} onClick={() => setCompact(true)} className={compact ? PRIMARY_BUTTON : SECONDARY_BUTTON_SM}>Compact</button>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showCost} onChange={(e) => setShowCost(e.target.checked)} />
          Show costs
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showPhotos} onChange={(e) => setShowPhotos(e.target.checked)} />
          Show photos
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showAllergens} onChange={(e) => setShowAllergens(e.target.checked)} />
          Show allergens
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showAbv} onChange={(e) => setShowAbv(e.target.checked)} />
          Show ABV
        </label>
        {present.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-slate-500">Type</span>
            {present.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={`${CHIP} ${selected.has(t) ? CHIP_ACTIVE : CHIP_IDLE}`}
              >
                {labelForType(t)}
              </button>
            ))}
          </div>
        )}
        <span className="ml-auto"><PrintReportButton label="Print spec cards" /></span>
      </div>

      {visible.length === 0 ? (
        <p className="no-print text-sm text-slate-500">No cards for the selected categories.</p>
      ) : (
        <div className={compact ? 'print:grid print:grid-cols-2 print:gap-4' : ''}>
          {visible.map((c) => (
            <SpecCard
              key={c.id}
              cocktail={c}
              priceIncludesVat={priceIncludesVat}
              compact={compact}
              showCost={showCost}
              showPhotos={showPhotos}
              showAllergens={showAllergens}
              showAbv={showAbv}
              cost={costById[c.id] ?? null}
            />
          ))}
        </div>
      )}
    </>
  )
}
