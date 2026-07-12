export function invoiceStatus(inv: { applied_line_count: number; line_count: number }): 'applied' | 'attention' {
  return inv.applied_line_count < inv.line_count ? 'attention' : 'applied'
}
