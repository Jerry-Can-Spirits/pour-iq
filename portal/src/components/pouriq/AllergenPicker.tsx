'use client'

import { ALLERGENS, ALLERGEN_LABELS, DIETARY, type AllergenKey, type DietaryKey } from '@/lib/pouriq/allergens'
import { CHIP, CHIP_ACTIVE, CHIP_IDLE, HELPER, LABEL } from '@/lib/pouriq/ui'

interface Props {
  allergens: AllergenKey[]
  dietary: DietaryKey[]
  reviewed: boolean
  onChange: (allergens: AllergenKey[], dietary: DietaryKey[], reviewed: boolean) => void
}

export function AllergenPicker({ allergens, dietary, reviewed, onChange }: Props) {
  function toggleAllergen(key: AllergenKey) {
    const next = allergens.includes(key)
      ? allergens.filter((a) => a !== key)
      : [...allergens, key]
    onChange(next, dietary, reviewed)
  }

  function toggleDietary(key: DietaryKey) {
    if (dietary.includes(key)) {
      onChange(allergens, dietary.filter((d) => d !== key), reviewed)
      return
    }
    let next: DietaryKey[] = [...dietary, key]
    if (key === 'vegan' && !next.includes('vegetarian')) {
      next = [...next, 'vegetarian']
    }
    onChange(allergens, next, reviewed)
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200">
        <p className="text-sm font-medium text-slate-700">Allergens and dietary</p>
      </div>
      <div className="px-4 py-4 space-y-4">
        <div>
          <p className={LABEL}>Contains (tick all that apply)</p>
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleAllergen(key)}
                className={`${CHIP} ${allergens.includes(key) ? CHIP_ACTIVE : CHIP_IDLE}`}
              >
                {ALLERGEN_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className={LABEL}>Dietary</p>
          <div className="flex flex-wrap gap-2">
            {DIETARY.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleDietary(key)}
                className={`${CHIP} ${dietary.includes(key) ? CHIP_ACTIVE : CHIP_IDLE}`}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
          <p className={HELPER}>Ticking vegan also ticks vegetarian.</p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(e) => onChange(allergens, dietary, e.target.checked)}
            className="mt-0.5 accent-emerald-600"
          />
          <span className="text-sm text-slate-700">
            These allergen details are confirmed. Positive dietary claims (vegetarian, vegan, gluten-free) are only shown when this is ticked.
          </span>
        </label>
      </div>
    </div>
  )
}
