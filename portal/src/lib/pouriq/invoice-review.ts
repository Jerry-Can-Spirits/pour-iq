// Pure classification of invoice preview lines for the attention-first review:
// which group a line belongs to, and the summary counts.

export type InvoiceLineCategory = 'needs-attention' | 'price-change' | 'auto-ok'

export interface InvoiceLineInput {
  matchKind: 'auto' | 'catalogue' | 'suggestions' | 'no-match'
  priceChanged: boolean // auto match AND the invoice net price differs from the stored cost
  resolved: boolean // no further action needed (skipped, or applied with a valid target/price)
}

export interface InvoiceReviewSummary {
  autoMatched: number
  needChoice: number
  newProducts: number
  unresolved: number
}

export function classifyInvoiceLine(i: InvoiceLineInput): InvoiceLineCategory {
  // Anything still needing a decision belongs in the (always-visible) attention
  // group — including an auto match the user un-resolved (e.g. cleared the
  // library selection) — so it is never hidden in the collapsed auto section.
  if (!i.resolved) return 'needs-attention'
  if (i.matchKind !== 'auto') return 'needs-attention'
  return i.priceChanged ? 'price-change' : 'auto-ok'
}

export function summariseInvoiceLines(items: InvoiceLineInput[]): InvoiceReviewSummary {
  let autoMatched = 0
  let needChoice = 0
  let newProducts = 0
  let unresolved = 0
  for (const i of items) {
    if (i.matchKind === 'auto') autoMatched++
    else if (i.matchKind === 'no-match') newProducts++
    else needChoice++ // catalogue | suggestions
    if (!i.resolved) unresolved++
  }
  return { autoMatched, needChoice, newProducts, unresolved }
}
