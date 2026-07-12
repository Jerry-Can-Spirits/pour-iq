// Pure validation lib for the import/commit route body.
// No next/server or @opennextjs/cloudflare imports — vitest can load this directly.

import { ALL_INGREDIENT_TYPES, type IngredientType } from '@/lib/pouriq/types'

export interface CommitIngredient {
  // Either pick an existing library entry...
  existing_library_id?: string
  // ...or commit a new library entry inline with the drink.
  new_library?: {
    name: string
    ingredient_type: IngredientType
    base_unit: 'ml' | 'g' | 'each'
    pack_size: number
    price_p: number
    price_includes_vat?: boolean
    purchase_qty: number
    pack_format?: string | null
  }
  pour_ml: number | null
  unit_count: number | null
  recipe_unit?: string | null
  recipe_qty?: number | null
}

export interface CommitDrink {
  name: string
  sale_price_p: number
  ingredients: CommitIngredient[]
}

export interface CommitBody {
  menuId: string
  drinks: CommitDrink[]
}

function isPositiveInteger(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0
}

function isNonNegativeInteger(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0
}

function isPositiveNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

// Validate the body shape and value ranges. Returns an error string or null.
export function validateBody(body: CommitBody): string | null {
  if (!body.menuId || typeof body.menuId !== 'string') return 'Invalid menuId'
  if (!Array.isArray(body.drinks) || body.drinks.length === 0) return 'No drinks to commit'

  for (let i = 0; i < body.drinks.length; i++) {
    const d = body.drinks[i]
    if (!d.name || typeof d.name !== 'string' || !d.name.trim()) return `Drink ${i + 1}: name required`
    if (!isPositiveInteger(d.sale_price_p)) return `Drink ${i + 1}: sale_price_p must be a positive integer`
    if (!Array.isArray(d.ingredients) || d.ingredients.length === 0) {
      return `Drink ${i + 1} (${d.name}): must have at least one ingredient`
    }

    for (let j = 0; j < d.ingredients.length; j++) {
      const ing = d.ingredients[j]
      const tag = `Drink ${i + 1} (${d.name}) ingredient ${j + 1}`

      const hasExisting = typeof ing.existing_library_id === 'string' && ing.existing_library_id.length > 0
      const hasNew = !!ing.new_library
      if (hasExisting === hasNew) return `${tag}: must reference exactly one library entry`

      if (hasNew && ing.new_library) {
        const nl = ing.new_library
        if (!nl.name || typeof nl.name !== 'string' || !nl.name.trim()) return `${tag}: new library name required`
        if (!ALL_INGREDIENT_TYPES.includes(nl.ingredient_type)) return `${tag}: invalid ingredient_type`
        if (!['ml', 'g', 'each'].includes(nl.base_unit)) return `${tag}: base_unit must be ml, g, or each`
        if (!isPositiveNumber(nl.pack_size)) return `${tag}: pack_size must be a positive number`
        if (!isNonNegativeInteger(nl.price_p)) return `${tag}: price_p must be a non-negative integer`
        if (!isPositiveInteger(nl.purchase_qty)) return `${tag}: purchase_qty must be a positive integer`
        if (nl.pack_format !== undefined && nl.pack_format !== null && typeof nl.pack_format !== 'string') {
          return `${tag}: pack_format must be a string if provided`
        }
      }

      const hasPour = ing.pour_ml !== null
      const hasCount = ing.unit_count !== null
      if (hasPour === hasCount) return `${tag}: must specify either pour_ml or unit_count, not both`
      if (hasPour && !isPositiveNumber(ing.pour_ml)) return `${tag}: pour_ml must be > 0`
      if (hasCount && !isPositiveNumber(ing.unit_count)) return `${tag}: unit_count must be > 0`

      const hasServeUnit = ing.recipe_unit !== undefined && ing.recipe_unit !== null
      const hasServeQty = ing.recipe_qty !== undefined && ing.recipe_qty !== null
      if (hasServeUnit !== hasServeQty) return `${tag}: recipe_unit and recipe_qty must be set together`
      if (hasServeUnit) {
        if (typeof ing.recipe_unit !== 'string' || !ing.recipe_unit.trim()) return `${tag}: recipe_unit must be a non-empty string`
        if (!isPositiveNumber(ing.recipe_qty)) return `${tag}: recipe_qty must be > 0`
      }
    }
  }
  return null
}
