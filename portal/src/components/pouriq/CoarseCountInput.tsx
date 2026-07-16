'use client'

// Stock count entry. For container stock (bottles, kegs, casks…) the count
// is captured as full/sealed containers plus the level of the one open
// container, picked from a fixed set (Empty / ¼ / ½ / ¾) rather than an
// eyeballed decimal — fast and consistent, and the small per-open-container
// error is carried by the trend, not any single count. Produce (counted in
// each / g) keeps a plain number field.
//
// The control is stateless: the parent owns the total as a string, and the
// full count and open fraction are derived from it. New counts always start
// from an empty field, so the derived value is only ever a multiple of 0.25
// (exact in binary) or empty.

const OPEN_LEVELS: readonly { label: string; value: number }[] = [
  { label: 'Empty', value: 0 },
  { label: '¼', value: 0.25 },
  { label: '½', value: 0.5 },
  { label: '¾', value: 0.75 },
]

const numberInputClass =
  'w-20 px-2 py-1 bg-white border border-slate-300 rounded-sm text-slate-900 text-sm focus:border-emerald-500 focus:outline-hidden'

const smallLabelClass = 'block text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1'

interface Props {
  value: string
  onChange: (next: string) => void
  baseUnit: 'ml' | 'each' | 'g'
  containerOne: string
  containerMany: string
  ariaLabel: string
  disabled?: boolean
}

function formatTotal(total: number): string {
  return Number.isInteger(total) ? String(total) : String(parseFloat(total.toFixed(2)))
}

export function CoarseCountInput({
  value,
  onChange,
  baseUnit,
  containerOne,
  containerMany,
  ariaLabel,
  disabled,
}: Props) {
  // Produce isn't containerised — keep the plain number field it always had.
  if (baseUnit !== 'ml') {
    return (
      <input
        type="number"
        step={baseUnit === 'each' ? 1 : 0.1}
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${numberInputClass} w-24`}
        placeholder={baseUnit}
        aria-label={ariaLabel}
        disabled={disabled}
      />
    )
  }

  const hasValue = value.trim() !== ''
  const total = hasValue ? parseFloat(value) || 0 : null
  const full = total === null ? '' : String(Math.floor(total + 1e-9))
  const fraction = total === null ? null : Math.round((total - Math.floor(total + 1e-9)) * 4) / 4

  function emitFull(nextFull: string) {
    const cleared = nextFull.trim() === ''
    if (cleared && (fraction === null || fraction === 0)) {
      onChange('')
      return
    }
    const f = cleared ? 0 : Math.max(0, Math.floor(parseFloat(nextFull) || 0))
    onChange(formatTotal(f + (fraction ?? 0)))
  }

  function emitFraction(fv: number) {
    const f = full === '' ? 0 : Math.max(0, Math.floor(parseFloat(full) || 0))
    onChange(formatTotal(f + fv))
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label>
        <span className={smallLabelClass}>Full {containerMany}</span>
        <input
          type="number"
          step={1}
          min={0}
          value={full}
          onChange={(e) => emitFull(e.target.value)}
          className={numberInputClass}
          aria-label={`${ariaLabel} — full ${containerMany}`}
          disabled={disabled}
        />
      </label>
      <div>
        <span className={smallLabelClass}>Open {containerOne}</span>
        <div role="group" aria-label={`${ariaLabel} — open ${containerOne} level`} className="inline-flex items-stretch rounded-md border border-slate-300 overflow-hidden">
          {OPEN_LEVELS.map((lvl, i) => {
            const selected = hasValue && fraction === lvl.value
            return (
              <button
                key={lvl.value}
                type="button"
                onClick={() => emitFraction(lvl.value)}
                aria-pressed={selected}
                disabled={disabled}
                className={`px-2.5 py-1.5 text-sm font-medium disabled:opacity-60 ${i > 0 ? 'border-l border-slate-300' : ''} ${
                  selected ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {lvl.label}
              </button>
            )
          })}
        </div>
      </div>
      {hasValue && (
        <span className="pb-1 text-sm text-slate-500">= {formatTotal(total as number)} {containerMany}</span>
      )}
    </div>
  )
}
