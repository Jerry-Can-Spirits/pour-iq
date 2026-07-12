'use client'

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import type { ProjectedCocktail } from '@/lib/pouriq/cost-impact'
import { PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'

function formatPct(n: number): string {
  return `${n.toFixed(1)}%`
}

interface Props {
  isOpen: boolean
  ingredientName: string
  newlyBelowTarget: ProjectedCocktail[]
  onCancel: () => void
  onConfirm: () => void
  submitting?: boolean
}

export function RippleConfirmModal({
  isOpen,
  ingredientName,
  newlyBelowTarget,
  onCancel,
  onConfirm,
  submitting = false,
}: Props) {
  const count = newlyBelowTarget.length
  return (
    <Dialog open={isOpen} onClose={() => { if (!submitting) onCancel() }} className="relative z-50">
      <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-6 shadow-2xl">
          <DialogTitle className="text-lg font-bold text-slate-900">
            {count === 1 ? '1 drink will drop below target' : `${count} drinks will drop below target`}
          </DialogTitle>
          <p className="mt-2 text-sm text-slate-600">
            Saving the new cost for <span className="font-medium text-slate-900">{ingredientName}</span> would push the following below their menu&rsquo;s target GP:
          </p>

          <ul className="mt-4 space-y-2 max-h-64 overflow-y-auto">
            {newlyBelowTarget.map((p) => (
              <li key={p.cocktail_id} className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-slate-900 font-medium">{p.cocktail_name}</span>
                  <span className="text-slate-500 text-xs">{p.menu_name}</span>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  GP {formatPct(p.current_gp_pct)} {'→'}{' '}
                  <strong className="text-rose-600">{formatPct(p.projected_gp_pct)}</strong>
                  <span className="text-slate-400"> (target {p.menu_target_gp_pct}%)</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm text-slate-700 hover:text-slate-900 disabled:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting}
              className={PRIMARY_BUTTON}
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
