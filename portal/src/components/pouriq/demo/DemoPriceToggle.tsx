'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Price toggle: change one menu line's price and watch its GP recompute
// live, using the product's exact net-sale formula (round(price / 1.20)
// when prices include VAT). Persists to the session overlay only.
//
// Copy (approved 2026-07-16): field labels Drink / Price / GP mirror the
// menu table's own vocabulary; the button reads "Update price" — not
// bare "Update" — so it names the local recalculation and never reads as
// save/commit, which the demo never does.
const VAT_DIVISOR = 1.2

export interface DemoDrink {
  cocktail_id: string
  name: string
  sale_price_p: number
  pour_cost_p: number
}

function netSaleP(priceP: number, includesVat: boolean): number {
  return includesVat ? Math.round(priceP / VAT_DIVISOR) : priceP
}

function gpPct(priceP: number, pourCostP: number, includesVat: boolean): number {
  const net = netSaleP(priceP, includesVat)
  if (net === 0) return 0
  return ((net - pourCostP) / net) * 100
}

export function DemoPriceToggle({ drinks, includesVat }: { drinks: DemoDrink[]; includesVat: boolean }) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState(drinks[0]?.cocktail_id ?? '')
  const drink = drinks.find((d) => d.cocktail_id === selectedId) ?? drinks[0]
  const [pounds, setPounds] = useState(((drink?.sale_price_p ?? 0) / 100).toFixed(2))
  const [saving, setSaving] = useState(false)

  if (!drink) return null

  const priceP = Math.round(parseFloat(pounds || '0') * 100)
  const validPrice = Number.isFinite(priceP) && priceP > 0
  const liveGp = validPrice ? gpPct(priceP, drink.pour_cost_p, includesVat) : null

  function onSelect(id: string) {
    setSelectedId(id)
    const d = drinks.find((x) => x.cocktail_id === id)
    if (d) setPounds((d.sale_price_p / 100).toFixed(2))
  }

  async function save() {
    if (!validPrice) return
    setSaving(true)
    try {
      const res = await fetch('/api/pouriq/demo/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cocktail_id: drink.cocktail_id, sale_price_p: priceP }),
      })
      // The endpoint writes the new price to the session overlay cookie;
      // refresh so the server-rendered menu table below re-reads it and
      // updates in place — matching the real editors, which refresh too.
      if (res.ok) router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Drink</span>
          <select
            value={selectedId}
            onChange={(e) => onSelect(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {drinks.map((d) => (
              <option key={d.cocktail_id} value={d.cocktail_id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Price</span>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">£</span>
            <input
              type="number"
              step="0.10"
              min="0"
              value={pounds}
              onChange={(e) => setPounds(e.target.value)}
              className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </label>
        <div className="text-sm">
          <span className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">GP</span>
          <span className="text-lg font-semibold text-slate-900">
            {liveGp === null ? '—' : `${liveGp.toFixed(1)}%`}
          </span>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!validPrice || saving}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Update price'}
        </button>
      </div>
    </section>
  )
}
