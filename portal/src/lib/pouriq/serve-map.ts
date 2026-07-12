// Serve token vocabulary for menu import. The extraction returns a serve token
// per beverage line; these helpers map it to a recipe-line serve (recipe_unit +
// recipe_qty + pour_ml, reusing the standard units in measures.ts) and to a
// sensible pack default (draught -> keg, wine/spirit -> bottle).

export type ServeToken =
  | '25ml' | '50ml' | 'half_pint' | 'pint' | '125ml' | '175ml' | '250ml' | 'glass'

const KNOWN: readonly ServeToken[] = ['25ml', '50ml', 'half_pint', 'pint', '125ml', '175ml', '250ml', 'glass']

export function isKnownServeToken(s: string): s is ServeToken {
  return (KNOWN as readonly string[]).includes(s)
}

export function coerceServeToken(raw: unknown): ServeToken | null {
  return typeof raw === 'string' && isKnownServeToken(raw) ? raw : null
}

export const SERVE_TOKEN_ML: Record<ServeToken, number> = {
  '25ml': 25, '50ml': 50, half_pint: 284, pint: 568,
  '125ml': 125, '175ml': 175, '250ml': 250, glass: 200,
}

// Map each token to a recipe-line serve. Draught + wine reuse the named standard
// units (pint/half pint/small|medium|large glass) so the drink editor shows the
// same wording; spirit/glass store a raw ml pour.
const RECIPE_UNIT: Record<ServeToken, { recipe_unit: string; recipe_qty: number }> = {
  half_pint: { recipe_unit: 'half pint', recipe_qty: 1 },
  pint: { recipe_unit: 'pint', recipe_qty: 1 },
  '125ml': { recipe_unit: 'small glass', recipe_qty: 1 },
  '175ml': { recipe_unit: 'medium glass', recipe_qty: 1 },
  '250ml': { recipe_unit: 'large glass', recipe_qty: 1 },
  '25ml': { recipe_unit: 'ml', recipe_qty: 25 },
  '50ml': { recipe_unit: 'ml', recipe_qty: 50 },
  glass: { recipe_unit: 'ml', recipe_qty: 200 },
}

export const SERVE_TOKEN_TO_UNIT_NAME: Record<ServeToken, string> =
  Object.fromEntries(Object.entries(RECIPE_UNIT).map(([k, v]) => [k, v.recipe_unit])) as Record<ServeToken, string>

export function serveToRecipeUnit(token: ServeToken): { recipe_unit: string; recipe_qty: number; pour_ml: number } {
  const u = RECIPE_UNIT[token]
  return { recipe_unit: u.recipe_unit, recipe_qty: u.recipe_qty, pour_ml: SERVE_TOKEN_ML[token] }
}

export function packDefaultForServe(token: ServeToken): { pack_format: string; pack_size: number } | null {
  if (token === 'pint' || token === 'half_pint') return { pack_format: 'keg', pack_size: 50000 }
  if (token === '125ml' || token === '175ml' || token === '250ml') return { pack_format: 'bottle', pack_size: 750 }
  if (token === '25ml' || token === '50ml') return { pack_format: 'bottle', pack_size: 700 }
  return null
}
