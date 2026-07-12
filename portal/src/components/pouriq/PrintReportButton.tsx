'use client'

import { SECONDARY_BUTTON } from '@/lib/pouriq/button-styles'

export function PrintReportButton({ label = 'Print report' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`${SECONDARY_BUTTON} no-print`}
    >
      {label}
    </button>
  )
}
