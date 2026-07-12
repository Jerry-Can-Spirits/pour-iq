// Parse raw measurement strings extracted by AI into either pour_ml
// (for liquid ingredients) or unit_count (for unit-priced/each ingredients).
// Examples in the spec:
//   "50ml"          → { pour_ml: 50 }
//   "1.5oz"         → { pour_ml: 44 }   (oz → ml, round to 5)
//   "barspoon"      → { pour_ml: 5, serve_unit: 'barspoon', serve_qty: 1 }
//   "2 dashes"      → { pour_ml: 1, serve_unit: 'dash', serve_qty: 2 }   (0.6ml per dash)
//   "tsp"           → { pour_ml: 5, serve_unit: 'tsp', serve_qty: 1 }
//   "1/2 lime"      → { unit_count: 0.5 }
//   "wedge"         → { unit_count: 0.125 }  (1/8 of a lime)
//   "1 sprig"       → { unit_count: 1 }
//   "top"           → { pour_ml: 50 }   (default soft top-up)
//   "5g"            → { weight_g: 5 }   (weight-bought ingredients)
//   "2kg"           → { weight_g: 2000 }
// Anything not matched returns { raw: input } for the UI to surface.
//
// The weight_g variant is for the inline-create prefill only: when an
// extracted measurement is in grams, the match row can default base_unit
// to 'g'. It does not map to a pour or unit count.

// When the input names a recognised bartending unit (dash/barspoon/tsp), the
// pour_ml variant carries serve_unit + serve_qty so the import row can default
// recipe_unit/recipe_qty directly from the parse result.
export type RecognisedServeUnit = 'dash' | 'barspoon' | 'tsp'

export type ParsedMeasurement =
  | { pour_ml: number; serve_unit?: RecognisedServeUnit; serve_qty?: number; unit_count?: never; weight_g?: never; raw?: never }
  | { unit_count: number; pour_ml?: never; weight_g?: never; raw?: never }
  | { weight_g: number; pour_ml?: never; unit_count?: never; raw?: never }
  | { raw: string; pour_ml?: never; unit_count?: never; weight_g?: never }

const OZ_TO_ML = 29.5735
function roundTo5(n: number): number {
  return Math.round(n / 5) * 5
}

export function parseMeasurement(input: string): ParsedMeasurement {
  const s = input.trim().toLowerCase()
  if (!s) return { raw: input }

  // Explicit ml
  const mlMatch = s.match(/^(\d+(?:\.\d+)?)\s*ml$/)
  if (mlMatch) return { pour_ml: Math.round(parseFloat(mlMatch[1])) }

  // Explicit grams / kilograms
  const gMatch = s.match(/^(\d+(?:\.\d+)?)\s*g$/)
  if (gMatch) return { weight_g: Math.round(parseFloat(gMatch[1])) }
  const kgMatch = s.match(/^(\d+(?:\.\d+)?)\s*kg$/)
  if (kgMatch) return { weight_g: Math.round(parseFloat(kgMatch[1]) * 1000) }

  // Explicit oz
  const ozMatch = s.match(/^(\d+(?:\.\d+)?)\s*oz$/)
  if (ozMatch) return { pour_ml: roundTo5(parseFloat(ozMatch[1]) * OZ_TO_ML) }

  // Barspoon (~5ml each, optional count)
  const barspoonMatch = s.match(/^(?:(\d+(?:\.\d+)?)\s+)?bar\s?spoons?$/)
  if (barspoonMatch) {
    const n = barspoonMatch[1] ? parseFloat(barspoonMatch[1]) : 1
    return { pour_ml: Math.round(n * 5), serve_unit: 'barspoon', serve_qty: n }
  }

  // Dash(es) — ~0.6ml per dash (STANDARD_SERVE_UNITS value)
  const dashMatch = s.match(/^(?:(\d+)\s+)?dashe?s?$/)
  if (dashMatch) {
    const n = dashMatch[1] ? parseInt(dashMatch[1], 10) : 1
    return { pour_ml: Math.round(n * 0.6), serve_unit: 'dash', serve_qty: n }
  }

  // Tsp / teaspoon (~5ml each, optional count)
  const tspMatch = s.match(/^(?:(\d+(?:\.\d+)?)\s+)?(?:tsp|teaspoons?)$/)
  if (tspMatch) {
    const n = tspMatch[1] ? parseFloat(tspMatch[1]) : 1
    return { pour_ml: Math.round(n * 5), serve_unit: 'tsp', serve_qty: n }
  }

  // Splash / top — default soft 50ml
  if (s === 'splash' || s === 'top' || s.startsWith('top with') || s.startsWith('top up')) {
    return { pour_ml: 50 }
  }

  // Fractions: "1/2 lime", "half lime", "1/4 lemon", "quarter lemon"
  const fractionMatch = s.match(/^(1\/2|1\/4|1\/8|3\/4|half|quarter)\b/)
  if (fractionMatch) {
    const map: Record<string, number> = {
      '1/8': 0.125, '1/4': 0.25, '1/2': 0.5, '3/4': 0.75,
      'half': 0.5, 'quarter': 0.25,
    }
    return { unit_count: map[fractionMatch[1]] }
  }

  // Wedge / wheel — assume 1/8 of a fruit
  if (s === 'wedge' || /wedge\b/.test(s)) {
    return { unit_count: 0.125 }
  }

  // Sprig / leaf / leaves — count of mint sprigs, default 1
  const sprigMatch = s.match(/^(?:(\d+)\s+)?(?:sprigs?|leaf|leaves)\b/)
  if (sprigMatch) {
    const n = sprigMatch[1] ? parseInt(sprigMatch[1], 10) : 1
    return { unit_count: n }
  }

  // Whole numbers preceding a unit-ish word: "1 lime", "2 oranges"
  const wholeUnitMatch = s.match(/^(\d+(?:\.\d+)?)\s+\w+/)
  if (wholeUnitMatch) {
    return { unit_count: parseFloat(wholeUnitMatch[1]) }
  }

  // Anything else: pass through for the UI to surface
  return { raw: input }
}
