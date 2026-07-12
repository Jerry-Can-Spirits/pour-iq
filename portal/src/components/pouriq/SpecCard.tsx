import type { CocktailWithIngredients } from '@/lib/pouriq/types'
import { formatServeMeasure } from '@/lib/pouriq/measures'
import { cocktailAllergenInfo, ALLERGEN_LABELS } from '@/lib/pouriq/allergens'
import { cocktailAbv } from '@/lib/pouriq/abv'

interface Props {
  cocktail: CocktailWithIngredients
  priceIncludesVat: boolean
  compact?: boolean
  showCost?: boolean
  showPhotos?: boolean
  showAllergens?: boolean
  showAbv?: boolean
  cost?: { pourCostP: number; gpPct: number; complete: boolean } | null
}

function formatPrice(pence: number, vatIncluded: boolean): string {
  const pounds = pence / 100
  return `£${pounds.toFixed(2)}${vatIncluded ? '' : ' net'}`
}


export function SpecCard({ cocktail, priceIncludesVat, compact = false, showCost = false, showPhotos = false, showAllergens = false, showAbv = false, cost = null }: Props) {
  const allergenInfo = showAllergens ? cocktailAllergenInfo(cocktail.ingredients) : null
  const abvInfo = showAbv ? cocktailAbv(cocktail.ingredients) : null
  const garnishes = cocktail.ingredients.filter(
    (i) => i.library.ingredient_type === 'garnish'
  )
  const pourIngredients = cocktail.ingredients.filter(
    (i) => i.library.ingredient_type !== 'garnish'
  )

  return (
    <article
      className={`
        mb-12 p-8
        bg-white border border-slate-200 rounded-xl
        print:bg-white print:border-stone-300 print:rounded-none
        ${compact
          ? 'print:p-4 print:mb-4 print:break-inside-avoid'
          : 'print:p-6 print:mb-0 print:break-before-page print:first:break-before-auto'}
      `}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3 pb-3 border-b border-slate-200 print:border-stone-300 mb-4">
        <h2 className="text-3xl font-bold text-slate-900 print:text-black">
          {cocktail.name}
        </h2>
        <p className="font-mono text-2xl text-emerald-700 print:text-black">
          {formatPrice(cocktail.sale_price_p, priceIncludesVat)}
        </p>
      </header>

      {showPhotos && cocktail.photo_r2_key && (
        <img
          src={`/api/pouriq/cocktails/${cocktail.id}/photo?v=${encodeURIComponent(cocktail.updated_at)}`}
          alt=""
          className="w-full h-48 object-contain rounded-lg mb-4 print:h-36"
        />
      )}

      {cocktail.glass != null && cocktail.glass.trim() !== '' && (
        <p className="text-sm text-slate-600 print:text-black mb-2">
          <span className="font-semibold">Glass:</span> {cocktail.glass}
        </p>
      )}

      {garnishes.length > 0 && (
        <p className="text-sm text-slate-600 print:text-black mb-6">
          <span className="font-semibold">Garnish:</span>{' '}
          {garnishes.map((g) => g.library.name).join(', ')}
        </p>
      )}

      <section className="mb-6">
        <h3 className="text-xs uppercase tracking-widest text-slate-500 print:text-black mb-2">
          Ingredients
        </h3>
        {pourIngredients.length === 0 ? (
          <p className="text-sm italic text-slate-500 print:text-stone-600">
            No ingredients recorded yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {pourIngredients.map((i) => (
              <li
                key={i.id}
                className="text-sm text-slate-700 print:text-black flex gap-3"
              >
                <span className="font-mono w-20 shrink-0">
                  {formatServeMeasure(i.recipe_unit, i.recipe_qty, i.pour_ml, i.unit_count)}
                </span>
                <span>{i.library.name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cocktail.notes != null && cocktail.notes.trim() !== '' && (
        <section className="mb-6">
          <h3 className="text-xs uppercase tracking-widest text-slate-500 print:text-black mb-2">
            Directions
          </h3>
          <p className="text-sm italic text-slate-600 print:text-stone-700">
            {cocktail.notes}
          </p>
        </section>
      )}

      {cocktail.description != null && cocktail.description.trim() !== '' && (
        <section className="mb-6">
          <h3 className="text-xs uppercase tracking-widest text-slate-500 print:text-black mb-2">
            Tell the customer
          </h3>
          <p className="text-sm text-slate-700 print:text-black leading-relaxed">
            {cocktail.description}
          </p>
        </section>
      )}

      {allergenInfo && (
        <section className="mb-6">
          {!allergenInfo.reviewed ? (
            <p className="text-xs text-amber-700 print:text-black">Allergen info incomplete for this drink.</p>
          ) : (
            <>
              {allergenInfo.contains.length > 0 ? (
                <p className="text-sm text-slate-700 print:text-black mb-1">
                  <span className="font-semibold">Contains:</span>{' '}
                  {allergenInfo.contains.map((a) => ALLERGEN_LABELS[a]).join(', ')}
                </p>
              ) : (
                <p className="text-sm text-slate-500 print:text-black mb-1">No regulated allergens declared.</p>
              )}
              {(allergenInfo.vegetarian || allergenInfo.vegan || allergenInfo.glutenFree) && (
                <div className="flex gap-2 mt-1">
                  {allergenInfo.vegetarian && (
                    <span className="text-xs px-1.5 py-0.5 bg-green-50 border border-green-300 text-green-700 rounded-sm print:bg-transparent print:border-black print:text-black">V</span>
                  )}
                  {allergenInfo.vegan && (
                    <span className="text-xs px-1.5 py-0.5 bg-green-50 border border-green-300 text-green-700 rounded-sm print:bg-transparent print:border-black print:text-black">Ve</span>
                  )}
                  {allergenInfo.glutenFree && (
                    <span className="text-xs px-1.5 py-0.5 bg-blue-50 border border-blue-300 text-blue-700 rounded-sm print:bg-transparent print:border-black print:text-black">GF</span>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {abvInfo && (
        <section className="mb-6">
          {abvInfo.complete ? (
            <p className="text-sm text-slate-700 print:text-black">
              <span className="font-semibold">ABV</span> {abvInfo.abvPct}% &middot; {abvInfo.units} units
            </p>
          ) : (
            <p className="text-xs text-amber-700 print:text-black">ABV estimate incomplete.</p>
          )}
        </section>
      )}

      {showCost && cost && (
        <p className="text-xs text-slate-500 print:text-stone-600 mb-4">
          {cost.complete
            ? `Pour cost £${(cost.pourCostP / 100).toFixed(2)} · GP ${cost.gpPct.toFixed(0)}%`
            : 'Cost incomplete'}
        </p>
      )}

      {cocktail.field_manual_slug != null &&
        /^[a-z0-9-]+$/.test(cocktail.field_manual_slug) && (
        <a
          href={`https://jerrycanspirits.co.uk/field-manual/cocktails/${cocktail.field_manual_slug}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm text-emerald-700 hover:text-emerald-600 print:text-black print:underline border-b border-emerald-600/40 hover:border-emerald-700 print:border-none pb-1"
        >
          Full method &amp; technique
          <span aria-hidden="true" className="ml-2 print:hidden">→</span>
        </a>
      )}
    </article>
  )
}
