'use client'

import { useEffect, useState } from 'react'
import {
  COST_UPDATE_TOAST_KEY,
  type CostUpdateToastPayload,
} from '@/lib/pouriq/cost-impact'
import { CostUpdateToast } from './CostUpdateToast'

export function CostUpdateToastReader() {
  const [data, setData] = useState<CostUpdateToastPayload | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem(COST_UPDATE_TOAST_KEY)
    if (!raw) return
    sessionStorage.removeItem(COST_UPDATE_TOAST_KEY)
    try {
      const parsed = JSON.parse(raw) as CostUpdateToastPayload
      if (parsed.newlyBelowTarget && parsed.newlyBelowTarget.length > 0) {
        setData(parsed)
      }
    } catch {
      // Malformed payload — drop it silently
    }
  }, [])

  if (!data) return null
  return (
    <CostUpdateToast
      ingredientName={data.ingredientName}
      newlyBelowTarget={data.newlyBelowTarget}
      onDismiss={() => setData(null)}
    />
  )
}
