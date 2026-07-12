'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  pricingMode,
  projectCocktail,
  rollupByMenu,
  type CostImpactPayload,
  type ProjectedCocktail,
} from '@/lib/pouriq/cost-impact'
import { RipplePreview } from './RipplePreview'

function formatMoney(p: number): string {
  return `£${(p / 100).toFixed(2)}`
}

interface Props {
  ingredientId: string
}

export function CostImpactPanel({ ingredientId }: Props) {
  const [data, setData] = useState<CostImpactPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [newCostPounds, setNewCostPounds] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/pouriq/library/${encodeURIComponent(ingredientId)}/impact`)
      .then((r) => (r.ok ? (r.json() as Promise<CostImpactPayload>) : Promise.reject(new Error('Could not load impact data'))))
      .then((d) => {
        if (cancelled) return
        setData(d)
        setNewCostPounds((d.ingredient.price_p / 100).toFixed(2))
        setError(null)
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [ingredientId])

  const projection = useMemo(() => {
    if (!data) return null
    const newCostP = Math.round((parseFloat(newCostPounds) || 0) * 100)
    const mode = pricingMode(data.ingredient)
    const currentP = data.ingredient.price_p
    const delta = newCostP - currentP
    const projected: ProjectedCocktail[] = data.affected.map((c) =>
      projectCocktail(data.ingredient, c, newCostP),
    )
    const rollups = rollupByMenu(projected)
    return { projected, rollups, newCostP, currentP, delta, mode }
  }, [data, newCostPounds])

  if (loading) {
    return <p className="text-sm text-slate-600">Loading impact…</p>
  }
  if (error || !data || !projection) {
    return <p role="alert" className="text-sm text-rose-600">{error ?? 'Could not load impact data'}</p>
  }

  const { ingredient } = data
  const { projected, rollups, currentP, delta, mode } = projection
  const unitLabel = mode === 'unit' ? 'per unit' : `per ${ingredient.pack_size}${ingredient.base_unit} pack`

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Cost change impact</h2>
        <p className="text-sm text-slate-600 mb-5">
          {ingredient.name} · current {formatMoney(currentP)} {unitLabel}
        </p>

        <label htmlFor="new-cost" className="block text-sm font-medium text-slate-700 mb-2">
          New cost ({unitLabel})
        </label>
        <input
          id="new-cost"
          type="number"
          step="0.01"
          min={0}
          value={newCostPounds}
          onChange={(e) => setNewCostPounds(e.target.value)}
          className="w-48 px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-hidden"
        />
        <p className="mt-3 text-sm text-slate-600">
          Change: <strong className={delta === 0 ? 'text-slate-700' : delta > 0 ? 'text-amber-600' : 'text-emerald-600'}>
            {delta === 0 ? 'no change' : `${delta > 0 ? '+' : ''}${formatMoney(delta)}`}
          </strong>{' '}
          {currentP > 0 && delta !== 0 && (
            <span className="text-slate-500">({((delta / currentP) * 100).toFixed(1)}%)</span>
          )}
        </p>
      </div>

      <RipplePreview projected={projected} rollups={rollups} />
    </div>
  )
}
