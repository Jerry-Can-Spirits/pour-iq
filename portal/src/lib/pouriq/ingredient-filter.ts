import type { IngredientLibraryRow } from './types'

// Filter the ingredient library by a name search and a category, where category
// is 'all', a specific ingredient_type, or the synthetic 'low-stock'.
export function filterIngredients(
  entries: IngredientLibraryRow[],
  opts: { search: string; category: string },
  lowStockIds: ReadonlySet<string>,
): IngredientLibraryRow[] {
  const q = opts.search.trim().toLowerCase()
  return entries.filter((e) => {
    if (q && !e.name.toLowerCase().includes(q)) return false
    if (opts.category === 'all') return true
    if (opts.category === 'low-stock') return lowStockIds.has(e.id)
    return e.ingredient_type === opts.category
  })
}
