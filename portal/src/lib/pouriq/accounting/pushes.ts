import type { AccountingProvider } from './types'

/** Sentinel error value written by claimPush. A row with this error is an
 *  in-flight claim (or a crash-left reservation) — never a real failure. */
export const PUSH_CLAIM_SENTINEL = '__claiming__'

export interface AccountingPushRow {
  id: string
  invoice_id: string
  connection_id: string | null
  provider: AccountingProvider
  status: 'pushed' | 'failed'
  external_bill_id: string | null
  error: string | null
  pushed_at: string
}

export interface PushResult {
  invoiceId: string
  connectionId: string
  provider: AccountingProvider
  status: 'pushed' | 'failed'
  externalBillId: string | null
  error: string | null
}

/** Upsert on (invoice_id, provider): a retry overwrites the failed row in
 *  place; a pushed row is never downgraded (callers check before pushing). */
export async function recordPushResult(db: D1Database, result: PushResult): Promise<void> {
  await db
    .prepare(`
      INSERT INTO pouriq_accounting_pushes
        (invoice_id, connection_id, provider, status, external_bill_id, error)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      ON CONFLICT(invoice_id, provider) DO UPDATE SET
        connection_id = excluded.connection_id,
        status = excluded.status,
        external_bill_id = excluded.external_bill_id,
        error = excluded.error,
        pushed_at = datetime('now')
    `)
    .bind(
      result.invoiceId, result.connectionId, result.provider,
      result.status, result.externalBillId, result.error ? result.error.slice(0, 500) : null,
    )
    .run()
}

/** Atomically reserve (invoice_id, provider) before calling the provider.
 *  Inserts a sentinel 'failed' row using the UNIQUE constraint as a mutex.
 *  Returns true only when this call inserted the row (meta.changes === 1).
 *  A false return means another invocation already holds the slot; callers
 *  inspect the row they read earlier to decide whether to skip or retry.
 *  A crash after claiming leaves a 'failed/__claiming__' row that is treated
 *  as retry-eligible by the sweep (same as any real failed row). */
export async function claimPush(
  db: D1Database,
  invoiceId: string,
  connectionId: string,
  provider: AccountingProvider,
): Promise<boolean> {
  const result = await db
    .prepare(`
      INSERT INTO pouriq_accounting_pushes
        (invoice_id, connection_id, provider, status, external_bill_id, error)
      VALUES (?1, ?2, ?3, 'failed', NULL, ?4)
      ON CONFLICT(invoice_id, provider) DO NOTHING
    `)
    .bind(invoiceId, connectionId, provider, PUSH_CLAIM_SENTINEL)
    .run()
  return result.meta.changes === 1
}

export async function getPushForInvoiceProvider(
  db: D1Database,
  invoiceId: string,
  provider: AccountingProvider,
): Promise<AccountingPushRow | null> {
  return await db
    .prepare(`SELECT * FROM pouriq_accounting_pushes WHERE invoice_id = ?1 AND provider = ?2`)
    .bind(invoiceId, provider)
    .first<AccountingPushRow>()
}

/** Latest push per invoice for list badges. Keyed by invoice_id. */
export async function getPushMapForInvoices(
  db: D1Database,
  invoiceIds: string[],
): Promise<Map<string, AccountingPushRow>> {
  if (invoiceIds.length === 0) return new Map()
  const placeholders = invoiceIds.map((_, i) => `?${i + 1}`).join(', ')
  const result = await db
    .prepare(`SELECT * FROM pouriq_accounting_pushes WHERE invoice_id IN (${placeholders})`)
    .bind(...invoiceIds)
    .all<AccountingPushRow>()
  return new Map((result.results ?? []).map((r) => [r.invoice_id, r]))
}
