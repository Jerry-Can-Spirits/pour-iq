// Helpers for the pouriq_cost_changes audit table. Cost changes can come from
// manual library edits (source='manual') or invoice commits (source='invoice').

export function pctChange(oldP: number | null, newP: number): number | null {
  if (oldP === null || oldP === 0) return null
  return Math.round(((newP - oldP) / oldP) * 100)
}

export type CostChangeSource = 'manual' | 'invoice'
export type CostPricingMode = 'bottle' | 'unit'

export interface CostChangeInsert {
  library_ingredient_id: string
  pricing_mode: CostPricingMode
  old_cost_p: number | null
  new_cost_p: number
  source: CostChangeSource
  invoice_id?: string | null
  invoice_line_id?: string | null
}

/**
 * Insert a row into pouriq_cost_changes. Caller is responsible for ensuring
 * the cost actually changed before calling (we don't no-op on equality).
 */
export async function insertCostChange(
  db: D1Database,
  data: CostChangeInsert,
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO pouriq_cost_changes
        (library_ingredient_id, pricing_mode, old_cost_p, new_cost_p, source, invoice_id, invoice_line_id)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    `)
    .bind(
      data.library_ingredient_id,
      data.pricing_mode,
      data.old_cost_p,
      data.new_cost_p,
      data.source,
      data.invoice_id ?? null,
      data.invoice_line_id ?? null,
    )
    .run()
}

export interface CostChangeRow {
  id: string
  library_ingredient_id: string
  pricing_mode: CostPricingMode
  old_cost_p: number | null
  new_cost_p: number
  source: CostChangeSource
  invoice_id: string | null
  invoice_line_id: string | null
  changed_at: string
}

export async function listCostChangesForInvoice(
  db: D1Database,
  invoiceId: string,
): Promise<CostChangeRow[]> {
  const result = await db
    .prepare(`SELECT * FROM pouriq_cost_changes WHERE invoice_id = ?1 ORDER BY changed_at ASC`)
    .bind(invoiceId)
    .all<CostChangeRow>()
  return result.results ?? []
}
