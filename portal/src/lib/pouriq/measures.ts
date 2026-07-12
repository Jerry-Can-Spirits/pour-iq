// Quick-select pour measures for recipe entry. "Dash" (~0.6ml, e.g. dashing
// bitters) and "Barspoon" (~5ml) cover the small bartending measures that a raw
// ml field alone makes fiddly to estimate. These are just quick chips; the ml
// field also takes free text for anything off-preset (7ml, 12.5ml, etc.).
// Shared by the add/edit drink form and the import match row so the options
// stay in sync.
// Parse a "N x Mml" / "N × Mcl" / "N x ML" pack pattern from a product name.
// Returns {purchase_qty, pack_size_ml} or null when no clear N×size is found.
// Recognises 'x', 'X', and the unicode '×' separator; units ml/cl/l (any case).
// Converts cl→ml (×10) and l/L→ml (×1000).
export function parsePackFormat(name: string): { purchase_qty: number; pack_size: number } | null {
  const toMl = (size: number, unit: string): number =>
    unit === 'cl' ? Math.round(size * 10) : unit === 'l' ? Math.round(size * 1000) : Math.round(size)
  const m = name.match(/(\d+)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(ml|cl|l)\b/i)
  if (m) {
    const qty = parseInt(m[1], 10)
    const pack_size = toMl(parseFloat(m[2]), m[3].toLowerCase())
    if (!Number.isFinite(qty) || qty < 1 || !Number.isFinite(pack_size) || pack_size < 1) return null
    return { purchase_qty: qty, pack_size }
  }
  // Invoice phrasings without the N×size shape: a case/pack count alongside a
  // bare size ("70cl case of 6", "330ml 24 pack", "70cl x6"). A size alone
  // still returns null — one bottle is not a pack. Count patterns in order:
  // "24 pack"/"24-pack"/"24pk" first (so "6-pack of 330ml" reads 6, not 330),
  // then "case/box/crate of 6" (rejecting "of 330ml" size false-positives),
  // then a trailing "x6".
  const count =
    name.match(/\b(\d+)\s*-?\s*(?:pack|pk)\b/i) ??
    name.match(/\b(?:case|pack|box|crate)\s+of\s+(\d+)\b(?!\s*(?:ml|cl|l)\b)/i) ??
    name.match(/(?:^|\s)[xX×]\s*(\d+)\b/)
  const size = name.match(/\b(\d+(?:\.\d+)?)\s*(ml|cl|l)\b/i)
  if (!count || !size) return null
  const qty = parseInt(count[1], 10)
  const pack_size = toMl(parseFloat(size[1]), size[2].toLowerCase())
  if (!Number.isFinite(qty) || qty < 1 || !Number.isFinite(pack_size) || pack_size < 1) return null
  return { purchase_qty: qty, pack_size }
}

export const POUR_PRESETS: ReadonlyArray<{ ml: number; label: string }> = [
  { ml: 0.6, label: 'Dash' },
  { ml: 5, label: 'Barspoon' },
  { ml: 10, label: '10ml' },
  { ml: 15, label: '15ml' },
  { ml: 25, label: '25ml' },
  { ml: 35, label: '35ml' },
  { ml: 50, label: '50ml' },
  { ml: 75, label: '75ml' },
  { ml: 100, label: '100ml' },
]

// Common per-item sizes for the "how you buy it" cost entry. Quick chips; the
// size field also accepts a typed value (e.g. 10000 for a 10L keg/BIB).
// Covers 150/200ml (Britvic/Fever-Tree splits) up to 2000ml bottled mixers.
export const BOTTLE_SIZES_ML: readonly number[] = [150, 200, 330, 500, 700, 750, 1000, 2000]

// Draught keg/cask sizes (ml) for the pack-size chips on beer. Quick chips only;
// the size field still takes free text for odd sizes (e.g. 40914 for a 9gal firkin).
export const KEG_SIZES_ML: readonly number[] = [20000, 30000, 50000]

// Common bag/tub sizes for weight-bought ingredients (spices, sugar, citric
// acid, etc.). Quick chips; the size field also accepts free text.
export const WEIGHT_SIZES_G: readonly number[] = [500, 1000, 2500, 5000]

// Quick-pick glassware for spec cards. The glass field also accepts free text,
// so anything not listed here can still be typed in.
export const GLASS_OPTIONS = ['Rocks', 'Highball', 'Collins', 'Coupe', 'Martini', 'Nick & Nora', 'Wine', 'Flute', 'Shot', 'Hurricane'] as const

export type BaseUnit = 'ml' | 'g' | 'each'
export interface ServeUnit { name: string; base_per_unit: number }

// Standard serve units available for any ingredient of the matching base unit,
// with no per-ingredient setup. base_per_unit is in that base unit.
export const STANDARD_SERVE_UNITS: Record<BaseUnit, ServeUnit[]> = {
  ml: [
    { name: 'ml', base_per_unit: 1 },
    { name: 'dash', base_per_unit: 0.6 },
    { name: 'barspoon', base_per_unit: 5 },
    { name: 'tsp', base_per_unit: 5 },
    // Draught and wine serves, so a beer or wine is "1 pint" / "1 large glass"
    // rather than a typed ml amount.
    { name: 'half pint', base_per_unit: 284 },
    { name: 'pint', base_per_unit: 568 },
    { name: 'small glass', base_per_unit: 125 },
    { name: 'medium glass', base_per_unit: 175 },
    { name: 'large glass', base_per_unit: 250 },
  ],
  g: [
    { name: 'g', base_per_unit: 1 },
    { name: 'pinch', base_per_unit: 0.3 },
  ],
  each: [{ name: 'item', base_per_unit: 1 }],
}

// Standard units for the base dimension + the ingredient's custom units.
// A custom unit overrides a standard one of the same name.
export function serveUnitsFor(baseUnit: BaseUnit, custom: ServeUnit[]): ServeUnit[] {
  const byName = new Map<string, ServeUnit>()
  for (const u of STANDARD_SERVE_UNITS[baseUnit]) byName.set(u.name, u)
  for (const u of custom) byName.set(u.name, u)
  return [...byName.values()]
}

// The base-unit amount stored on the recipe line (pour_ml for ml/g, unit_count for each).
export function recipeBaseAmount(recipe_qty: number, base_per_unit: number): number {
  return recipe_qty * base_per_unit
}

// Pluralise a unit name. Handles -sh/-ch/-s/-x → add 'es'; otherwise add 's'.
function pluralise(unit: string, qty: number): string {
  if (qty === 1) return unit
  if (/(?:sh|ch|[sx])$/i.test(unit)) return unit + 'es'
  return unit + 's'
}

// Format a qty number: converts number to string.
function fmtQty(qty: number): string {
  return String(qty)
}

/**
 * Format a recipe-line measure for display.
 *
 * When recipe_unit and recipe_qty are present (new rows):
 *   ml / g → "{qty} ml" / "{qty} g" (no pluralisation)
 *   other  → "{qty} {unit}" with simple English pluralisation
 *
 * Falls back to the base-amount fields for older rows.
 */
export function formatServeMeasure(
  recipe_unit: string | null,
  recipe_qty: number | null,
  pour_ml: number | null,
  unit_count: number | null,
): string {
  if (recipe_unit !== null && recipe_qty !== null) {
    const q = fmtQty(recipe_qty)
    if (recipe_unit === 'ml' || recipe_unit === 'g') return `${q} ${recipe_unit}`
    return `${q} ${pluralise(recipe_unit, recipe_qty)}`
  }
  if (pour_ml != null) return `${pour_ml}ml`
  if (unit_count != null) return unit_count === 1 ? '1 unit' : `${unit_count} units`
  return ''
}
