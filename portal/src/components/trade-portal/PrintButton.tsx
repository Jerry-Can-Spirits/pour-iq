'use client'

import { SECONDARY_BUTTON } from '@/lib/pouriq/button-styles'

export function PrintButton({ label = 'Print or save as PDF' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={SECONDARY_BUTTON}>
      {label}
    </button>
  )
}
