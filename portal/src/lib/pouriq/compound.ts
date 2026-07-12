// Split compound ingredient lines like "Lime & Apple juice" into their atoms
// ("Lime juice" + "Apple juice") before matching, so each costs separately.
// Conservative: only fires when a recognised noun trails a two-part list
// joined by "&", "and" or "/". The measurement is even-split 50/50 when it is
// a plain volume; otherwise both atoms keep the original measurement.

const COMPOUND_NOUNS = ['juice', 'syrup', 'puree', 'purée', 'cordial', 'bitters', 'liqueur'] as const

const COMPOUND_RE = new RegExp(`^(.+?)\\s+(${COMPOUND_NOUNS.join('|')})$`, 'i')
const SEPARATOR_RE = /\s*(?:&|\band\b|\/)\s*/i

// Halve a plain volume measurement, preserving the unit. Returns null when the
// measurement is not a single numeric volume (dashes, "wedge", "top", "1 lime").
export function halfMeasure(raw: string): string | null {
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(ml|cl|l|oz)$/i)
  if (!m) return null
  const half = parseFloat(m[1]) / 2
  return `${half}${m[2].toLowerCase()}`
}

export function splitCompoundIngredients<T extends { name: string; raw_measurement: string }>(
  ingredients: T[],
): T[] {
  return ingredients.flatMap((ing) => {
    const m = ing.name.trim().match(COMPOUND_RE)
    if (!m) return [ing]
    // A comma signals a 3+ item list, so leave it intact rather than guess.
    if (m[1].includes(',')) return [ing]
    const noun = m[2]
    const parts = m[1].split(SEPARATOR_RE).map((p) => p.trim()).filter((p) => p.length > 0)
    if (parts.length !== 2) return [ing]
    const measure = halfMeasure(ing.raw_measurement) ?? ing.raw_measurement
    return parts.map((p) => ({
      ...ing,
      name: `${p} ${noun}`,
      raw_measurement: measure,
      ...('base_product' in ing ? { base_product: null } : {}),
      ...('serve' in ing ? { serve: null } : {}),
    } as unknown as T))
  })
}
