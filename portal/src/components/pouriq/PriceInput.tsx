'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Current value in pence, or null when unset. */
  valueP: number | null
  /** Called with the new value in pence (0 when the field is cleared). */
  onChangeP: (pence: number) => void
  id?: string
  placeholder?: string
  className?: string
  'aria-label'?: string
  /** Fired on blur, after the latest value has been emitted. */
  onCommit?: () => void
}

function penceToText(p: number | null): string {
  return p === null ? '' : (p / 100).toFixed(2)
}

/**
 * Money input that lets you type naturally. The value is held as raw text and
 * only converted to pence under the hood — it is NOT reformatted on every
 * keystroke, which is what previously yanked the cursor into the pence and
 * forced a double-click. A decimal text field (not a number spinner) keeps
 * typing reliable and gives mobile a numeric keypad.
 */
export function PriceInput({ valueP, onChangeP, id, placeholder, className, 'aria-label': ariaLabel, onCommit }: Props) {
  const [text, setText] = useState(() => penceToText(valueP))
  // Tracks the pence value this input last emitted, so we can tell an external
  // change (e.g. a pricing-mode reset) apart from our own keystroke echoing back.
  const lastEmitted = useRef<number | null>(valueP)

  useEffect(() => {
    if (valueP !== lastEmitted.current) {
      setText(penceToText(valueP))
      lastEmitted.current = valueP
    }
  }, [valueP])

  function handleChange(raw: string) {
    setText(raw)
    const parsed = raw.trim() === '' ? 0 : Math.round(parseFloat(raw) * 100)
    const safe = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    lastEmitted.current = safe
    onChangeP(safe)
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => onCommit?.()}
      className={className}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  )
}
