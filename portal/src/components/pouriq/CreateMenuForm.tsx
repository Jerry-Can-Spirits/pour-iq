'use client'

import { useState } from 'react'
import { createMenuAction } from '@/lib/pouriq/server-actions'
import { INPUT, LABEL } from '@/lib/pouriq/ui'
import { PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'

export function CreateMenuForm() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function action(formData: FormData) {
    setError(null)
    setSubmitting(true)
    try {
      await createMenuAction(formData)
    } catch (e) {
      setError((e as Error).message || 'Could not create menu')
      setSubmitting(false)
    }
  }

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="name" className={LABEL}>Menu name *</label>
        <input id="name" name="name" required className={INPUT} placeholder="e.g. Summer 2026" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="venue_type" className={LABEL}>Venue type</label>
          <select id="venue_type" name="venue_type" className={INPUT}>
            <option value="">Select</option>
            <option value="pub">Pub</option>
            <option value="cocktail-bar">Cocktail bar</option>
            <option value="restaurant">Restaurant</option>
            <option value="hotel">Hotel</option>
            <option value="club">Club</option>
          </select>
        </div>
        <div>
          <label htmlFor="positioning" className={LABEL}>Positioning</label>
          <select id="positioning" name="positioning" className={INPUT}>
            <option value="">Select</option>
            <option value="premium">Premium</option>
            <option value="casual">Casual</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="city" className={LABEL}>City</label>
          <input id="city" name="city" className={INPUT} />
        </div>
        <div>
          <label htmlFor="target_gp_pct" className={LABEL}>Target GP %</label>
          <input id="target_gp_pct" name="target_gp_pct" type="number" min={0} max={100} step={0.5} defaultValue={75} className={INPUT} />
        </div>
      </div>
      <div>
        <label className={LABEL}>Sale prices</label>
        <div className="space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="radio" name="prices_include_vat" value="1" defaultChecked className="mt-1 accent-emerald-600" />
            <span className="text-sm text-slate-700">
              Include VAT (20%)
              <span className="block text-xs text-slate-500 mt-0.5">Prices match what you show customers on the menu.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="radio" name="prices_include_vat" value="0" className="mt-1 accent-emerald-600" />
            <span className="text-sm text-slate-700">
              Net of VAT
              <span className="block text-xs text-slate-500 mt-0.5">Prices match what hits your P&amp;L (post-VAT).</span>
            </span>
          </label>
        </div>
      </div>
      <div>
        <label htmlFor="notes" className={LABEL}>Notes</label>
        <textarea id="notes" name="notes" rows={3} className={`${INPUT} resize-vertical`} />
      </div>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <button type="submit" disabled={submitting} className={PRIMARY_BUTTON}>
        {submitting ? 'Creating…' : 'Create menu'}
      </button>
    </form>
  )
}
