import type { IngredientType } from './types'

export interface ServePreset { name: string; ml: number }

const PRESETS: Partial<Record<IngredientType, ServePreset[]>> = {
  spirit: [{ name: 'Single', ml: 25 }, { name: 'Double', ml: 50 }],
  liqueur: [{ name: 'Single', ml: 25 }, { name: 'Double', ml: 50 }],
  wine: [{ name: 'Small', ml: 125 }, { name: 'Medium', ml: 175 }, { name: 'Large', ml: 250 }, { name: 'Bottle', ml: 750 }],
  beer: [{ name: 'Half', ml: 284 }, { name: 'Pint', ml: 568 }],
  cider: [{ name: 'Half', ml: 284 }, { name: 'Pint', ml: 568 }],
  'soft-drink': [{ name: 'Splash', ml: 25 }, { name: 'Small (half)', ml: 284 }, { name: 'Pint', ml: 568 }],
  mixer: [{ name: 'Splash', ml: 25 }, { name: 'Small (half)', ml: 284 }, { name: 'Pint', ml: 568 }],
  juice: [{ name: 'Splash', ml: 25 }, { name: 'Small', ml: 125 }],
  'alcohol-free': [{ name: 'Half', ml: 284 }, { name: 'Pint', ml: 568 }],
}

export function servePresetsFor(type: IngredientType): ServePreset[] {
  return PRESETS[type] ?? []
}
export function defaultServeName(ingredientName: string, presetName: string): string {
  return `${ingredientName} ${presetName}`.trim()
}
