// Pure helpers: committed invoice rows -> provider-neutral bill, plus the
// token-expiry decision. Kept free of D1/fetch so they unit-test directly.

import type { NeutralBill } from './types'

export interface BillInvoiceHeader {
  supplier_name: string | null
  invoice_number: string | null
  invoice_date: string | null
  created_at: string
  prices_include_vat: number | null
}

export interface BillInvoiceLine {
  extracted_name: string
  extracted_quantity: number | null
  extracted_unit_price_p: number
  extracted_line_total_p: number | null
  applied: number
}

export function buildBill(invoice: BillInvoiceHeader, lines: BillInvoiceLine[]): NeutralBill | null {
  const applied = lines.filter((l) => l.applied === 1)
  if (applied.length === 0) return null
  return {
    supplierName: invoice.supplier_name?.trim() || 'Unknown supplier',
    reference: invoice.invoice_number,
    dateISO: (invoice.invoice_date?.trim() || invoice.created_at).slice(0, 10),
    amountsIncludeTax: invoice.prices_include_vat === 1,
    lines: applied.map((l) => ({
      description: l.extracted_name,
      quantity: l.extracted_quantity ?? 1,
      unitAmountP: l.extracted_unit_price_p,
      lineTotalP: l.extracted_line_total_p,
    })),
  }
}

// Refresh this close to expiry. Xero access tokens live ~30 minutes and
// QBO ~60; a 2 minute skew absorbs clock drift without refresh churn.
const TOKEN_REFRESH_SKEW_MS = 2 * 60 * 1000

export function needsTokenRefresh(tokenExpiresAt: string | null, nowMs: number): boolean {
  if (!tokenExpiresAt) return true
  const expiresMs = new Date(tokenExpiresAt).getTime()
  if (!Number.isFinite(expiresMs)) return true
  return expiresMs - nowMs < TOKEN_REFRESH_SKEW_MS
}

export function poundsFromPence(p: number): number {
  return Math.round(p) / 100
}
