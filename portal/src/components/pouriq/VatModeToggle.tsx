'use client'

import { useState, useTransition } from 'react'
import { setMenuVatModeAction } from '@/lib/pouriq/server-actions'

interface Props {
  menuId: string
  pricesIncludeVat: boolean
}

const segBase = 'px-3 py-1.5 text-xs font-semibold transition-colors'
const segActive = 'bg-emerald-50 text-emerald-700'
const segIdle = 'text-slate-500 hover:text-slate-700'

export function VatModeToggle({ menuId, pricesIncludeVat }: Props) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const value = optimistic ?? pricesIncludeVat

  function flip(next: boolean) {
    if (next === value || pending) return
    setError(null)
    setOptimistic(next)
    startTransition(async () => {
      try {
        await setMenuVatModeAction(menuId, next)
      } catch (e) {
        setOptimistic(null)
        setError((e as Error).message || 'Could not update VAT mode')
      }
    })
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="text-[10px] uppercase tracking-widest text-slate-500">Prices</span>
      <span
        role="group"
        aria-label="Sale prices VAT mode"
        className="inline-flex items-stretch rounded-lg border border-slate-300 overflow-hidden bg-white"
      >
        <button
          type="button"
          onClick={() => flip(true)}
          disabled={pending}
          aria-pressed={value === true}
          className={`${segBase} ${value ? segActive : segIdle}`}
        >
          Inc VAT
        </button>
        <span aria-hidden="true" className="w-px bg-slate-300" />
        <button
          type="button"
          onClick={() => flip(false)}
          disabled={pending}
          aria-pressed={value === false}
          className={`${segBase} ${!value ? segActive : segIdle}`}
        >
          Net VAT
        </button>
      </span>
      {error && <span role="alert" className="text-xs text-rose-600">{error}</span>}
    </span>
  )
}
