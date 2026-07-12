import type { IngredientType, ItemType } from './types'

// Coarse drink type from its recipe. >1 ingredient is a cocktail; a single
// ingredient takes that ingredient's category; empty defaults to cocktail.
export function itemTypeFromIngredients(ingredientTypes: IngredientType[]): ItemType {
  if (ingredientTypes.length !== 1) return 'cocktail'
  switch (ingredientTypes[0]) {
    case 'beer': return 'beer'
    case 'cider': return 'cider'
    case 'wine': return 'wine'
    case 'spirit': case 'liqueur': return 'spirit'
    case 'soft-drink': case 'alcohol-free': case 'mixer': case 'juice': return 'soft-drink'
    case 'food': return 'food'
    default: return 'other'
  }
}
