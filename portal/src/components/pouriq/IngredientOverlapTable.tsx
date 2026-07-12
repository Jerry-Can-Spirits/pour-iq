import type { IngredientOverlap } from '@/lib/pouriq/types'

export function IngredientOverlapTable({ overlap }: { overlap: IngredientOverlap[] }) {
  if (overlap.length === 0) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
      <table className="w-full text-sm min-w-[480px]">
        <thead className="bg-slate-50">
          <tr className="text-left text-slate-500 text-xs uppercase tracking-widest">
            <th className="px-4 py-3">Ingredient</th>
            <th className="px-4 py-3">Used in</th>
          </tr>
        </thead>
        <tbody>
          {overlap.map((o) => (
            <tr key={o.ingredient_name} className="border-t border-slate-100">
              <td className="px-4 py-3 text-slate-900">{o.ingredient_name}</td>
              <td className={`px-4 py-3 ${o.cocktail_count === 1 ? 'text-rose-600' : 'text-slate-700'}`}>
                {o.cocktail_count} drink{o.cocktail_count === 1 ? '' : 's'}
                {o.cocktail_count === 1 && ' (single-use)'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
