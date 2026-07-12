import type { IngredientType } from './types'

export const ALCOHOLIC_TYPES = new Set<IngredientType>(['spirit', 'liqueur', 'wine', 'beer', 'cider'])

export function isAlcoholicType(t: IngredientType): boolean { return ALCOHOLIC_TYPES.has(t) }

function round1(n: number): number { return Math.round(n * 10) / 10 }

export function cocktailAbv(
  ingredients: { pour_ml: number | null; library: { abv: number; ingredient_type: IngredientType } }[],
): { abvPct: number; units: number; complete: boolean } {
  const complete = ingredients
    .filter((i) => isAlcoholicType(i.library.ingredient_type))
    .every((i) => i.library.abv > 0)
  let alcoholMl = 0
  let volumeMl = 0
  for (const i of ingredients) {
    if (i.pour_ml == null) continue
    volumeMl += i.pour_ml
    alcoholMl += i.pour_ml * (i.library.abv / 100)
  }
  const abvPct = volumeMl > 0 ? round1((alcoholMl / volumeMl) * 100) : 0
  return { abvPct, units: round1(alcoholMl / 10), complete }
}
