'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MenuRollup, ProjectedCocktail } from '@/lib/pouriq/cost-impact'
import { RipplePreview } from '@/components/pouriq/RipplePreview'

// The headline demo moment. Copy supplied and byte-exact. The result is
// rendered with the product's own RipplePreview so no new copy is coined.
const PROMPT_TEXT = 'A Harrier delivery just landed. Scan the invoice and watch it ripple through your menu.'
const BUTTON_TEXT = 'Scan the invoice'

interface RippleResult {
  projected: ProjectedCocktail[]
  rollups: MenuRollup[]
}

export function DemoScanRipple({ initiallyApplied = false }: { initiallyApplied?: boolean }) {
  const [result, setResult] = useState<RippleResult | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pouriq/demo/ripple', { method: 'POST' })
      if (res.ok) {
        const data = (await res.json()) as RippleResult
        setResult({ projected: data.projected, rollups: data.rollups })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Persisted in the overlay: re-show the ripple after a reload.
  useEffect(() => {
    if (initiallyApplied) void run()
  }, [initiallyApplied, run])

  return (
    <section className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <p className="text-sm text-emerald-900 mb-4">{PROMPT_TEXT}</p>
      {result === null ? (
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {loading ? BUTTON_TEXT : BUTTON_TEXT}
        </button>
      ) : (
        <RipplePreview projected={result.projected} rollups={result.rollups} />
      )}
    </section>
  )
}
