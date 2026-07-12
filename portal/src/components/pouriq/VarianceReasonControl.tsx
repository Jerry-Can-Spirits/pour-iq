'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { VARIANCE_REASONS } from '@/lib/pouriq/types'
import { setVarianceReasonAction } from '@/lib/pouriq/server-actions'
import { SECONDARY_BUTTON_SM } from '@/lib/pouriq/button-styles'

export function VarianceReasonControl({ ingredientId, current }: { ingredientId: string; current: string | null }) {
  const router = useRouter()
  const [reason, setReason] = useState(current ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function save() {
    setError(null)
    startTransition(async () => {
      try {
        await setVarianceReasonAction(ingredientId, reason || null)
        router.refresh()
      } catch (e) {
        setError((e as Error).message || 'Could not save reason.')
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-label="Variance reason"
        className="px-2 py-1 bg-white border border-slate-300 rounded-sm text-slate-900 text-sm focus:border-emerald-500 focus:outline-hidden"
      >
        <option value="">No reason set</option>
        {VARIANCE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className={SECONDARY_BUTTON_SM}
      >
        Save reason
      </button>
      {error && <span role="alert" className="text-xs text-rose-600">{error}</span>}
    </div>
  )
}
