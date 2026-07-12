export const ALLERGENS = ['celery', 'gluten', 'crustaceans', 'eggs', 'fish', 'lupin', 'milk', 'molluscs', 'mustard', 'nuts', 'peanuts', 'sesame', 'soya', 'sulphites'] as const
export type AllergenKey = typeof ALLERGENS[number]

export const ALLERGEN_LABELS: Record<AllergenKey, string> = {
  celery: 'Celery',
  gluten: 'Gluten',
  crustaceans: 'Crustaceans',
  eggs: 'Eggs',
  fish: 'Fish',
  lupin: 'Lupin',
  milk: 'Milk',
  molluscs: 'Molluscs',
  mustard: 'Mustard',
  nuts: 'Tree nuts',
  peanuts: 'Peanuts',
  sesame: 'Sesame',
  soya: 'Soya',
  sulphites: 'Sulphites',
}

export const DIETARY = ['vegetarian', 'vegan'] as const
export type DietaryKey = typeof DIETARY[number]

export function parseTags(json: string): string[] {
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function cocktailAllergenInfo(
  ingredients: { library: { allergens: string; dietary: string; allergens_reviewed: number } }[],
): { contains: AllergenKey[]; reviewed: boolean; vegetarian: boolean; vegan: boolean; glutenFree: boolean } {
  const reviewed = ingredients.length > 0 && ingredients.every((i) => i.library.allergens_reviewed === 1)
  const set = new Set<string>()
  for (const i of ingredients) for (const a of parseTags(i.library.allergens)) set.add(a)
  const contains = ALLERGENS.filter((a) => set.has(a))
  const diet = ingredients.map((i) => parseTags(i.library.dietary))
  const vegan = reviewed && diet.every((d) => d.includes('vegan'))
  const vegetarian = reviewed && diet.every((d) => d.includes('vegetarian') || d.includes('vegan'))
  const glutenFree = reviewed && !contains.includes('gluten')
  return { contains, reviewed, vegetarian, vegan, glutenFree }
}
