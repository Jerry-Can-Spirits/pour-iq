// Best-effort push of one committed invoice to the venue's accounting
// connection, plus the hourly retry sweep. A failed push NEVER fails the
// commit: the invoice is already safely in Pour IQ; this is downstream
// bookkeeping. Auth failures are never auto-retried in a loop (Intuit
// questionnaire commitment) — they land in the retry queue for the sweep
// or the per-invoice Retry action after the venue reconnects.

import * as Sentry from '@/lib/sentry'
import { buildBill, needsTokenRefresh, type BillInvoiceHeader, type BillInvoiceLine } from './bill-builder'
import {
  isConnectionReady, listAccountingConnections,
  markAccountingAuthFailure, markAccountingPushError, markAccountingPushSuccess, updateAccountingTokens,
} from './connections'
import { claimPush, getPushForInvoiceProvider, recordPushResult } from './pushes'
import { getAccountingAdapter, type AccountingProvidersEnv } from './providers'
import type { AccountingAdapter, AccountingConnection } from './types'

const SWEEP_BATCH_LIMIT = 25

export type PushOutcome = 'pushed' | 'failed' | 'auth-failed' | 'skipped'

async function ensureFreshToken(
  db: D1Database,
  adapter: AccountingAdapter,
  conn: AccountingConnection,
): Promise<AccountingConnection> {
  if (!needsTokenRefresh(conn.token_expires_at, Date.now())) return conn
  if (!conn.refresh_token) throw new Error('No refresh token; reconnect required')
  const tokens = await adapter.refreshAccessToken(conn.refresh_token)
  await updateAccountingTokens(db, conn.id, tokens)
  return {
    ...conn,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken ?? conn.refresh_token,
    token_expires_at: tokens.expiresAt,
  }
}

/** Push one invoice to one known connection. Never throws: every failure
 *  mode is recorded and classified. Auth failures (revoked/expired refresh
 *  token, or a 401 from the push) pause the connection instead of looping. */
export async function pushInvoiceWithConnection(
  db: D1Database,
  env: AccountingProvidersEnv,
  conn: AccountingConnection,
  invoiceId: string,
): Promise<PushOutcome> {
  try {
    const existing = await getPushForInvoiceProvider(db, invoiceId, conn.provider)
    if (existing?.status === 'pushed') return 'skipped'

    const adapter = getAccountingAdapter(conn.provider, env)
    if (!adapter) return 'skipped'

    // Claim the (invoice_id, provider) slot before touching the provider.
    // ON CONFLICT DO NOTHING turns the UNIQUE constraint into a mutex:
    // only the invocation that inserts the sentinel row (changes === 1)
    // proceeds to push. If the claim is lost and there is no prior failed
    // row (pure race on a fresh invoice) we skip. If there IS a prior
    // failed row — including a crash-left '__claiming__' sentinel — this
    // invocation is the retry and is allowed to proceed.
    const claimed = await claimPush(db, invoiceId, conn.id, conn.provider)
    if (!claimed && existing?.status !== 'failed') return 'skipped'

    const invoice = await db
      .prepare(`SELECT supplier_name, invoice_number, invoice_date, created_at, prices_include_vat
                FROM pouriq_invoices WHERE id = ?1 AND trade_account_id = ?2`)
      .bind(invoiceId, conn.trade_account_id)
      .first<BillInvoiceHeader>()
    if (!invoice) return 'skipped'
    const lines = await db
      .prepare(`SELECT extracted_name, extracted_quantity, extracted_unit_price_p, extracted_line_total_p, applied
                FROM pouriq_invoice_lines WHERE invoice_id = ?1`)
      .bind(invoiceId)
      .all<BillInvoiceLine>()
    const bill = buildBill(invoice, lines.results ?? [])
    if (!bill) return 'skipped'

    let fresh: AccountingConnection
    try {
      fresh = await ensureFreshToken(db, adapter, conn)
    } catch (e) {
      const message = (e as Error)?.message ?? 'unknown'
      await recordFailure(db, conn, invoiceId, message)
      await markAccountingAuthFailure(db, conn.id, message)
      Sentry.captureException(e, {
        tags: { feature: 'pouriq-accounting-push', provider: conn.provider },
        extra: { invoiceId, phase: 'token-refresh' },
      })
      return 'auth-failed'
    }

    try {
      const { externalBillId } = await adapter.pushBill(fresh, bill)
      await recordPushResult(db, {
        invoiceId, connectionId: conn.id, provider: conn.provider,
        status: 'pushed', externalBillId, error: null,
      })
      await markAccountingPushSuccess(db, conn.id)
      return 'pushed'
    } catch (e) {
      const message = (e as Error)?.message ?? 'unknown'
      await recordFailure(db, conn, invoiceId, message)
      // Status is anchored right after the provider name; body text may echo "401" in amounts
      if (/^\w+ 401\b/.test(message)) {
        await markAccountingAuthFailure(db, conn.id, message)
        Sentry.captureException(e, {
          tags: { feature: 'pouriq-accounting-push', provider: conn.provider },
          extra: { invoiceId, phase: 'push' },
        })
        return 'auth-failed'
      }
      await markAccountingPushError(db, conn.id, message)
      Sentry.captureException(e, {
        tags: { feature: 'pouriq-accounting-push', provider: conn.provider },
        extra: { invoiceId, phase: 'push' },
      })
      return 'failed'
    }
  } catch (e) {
    try {
      const message = (e as Error)?.message ?? 'unknown'
      Sentry.captureException(e, {
        tags: { feature: 'pouriq-accounting-push', provider: conn.provider },
        extra: { invoiceId },
      })
      await recordFailure(db, conn, invoiceId, message)
      await markAccountingPushError(db, conn.id, message)
    } catch { /* push bookkeeping must never break the caller */ }
    return 'failed'
  }
}

async function recordFailure(
  db: D1Database, conn: AccountingConnection, invoiceId: string, message: string,
): Promise<void> {
  await recordPushResult(db, {
    invoiceId, connectionId: conn.id, provider: conn.provider,
    status: 'failed', externalBillId: null, error: message,
  })
}

/** Commit-hook entry: resolve the venue's first ready connection and push.
 *  Never throws — a failed push must not fail the commit. */
export async function pushInvoiceToAccounting(
  db: D1Database,
  env: AccountingProvidersEnv,
  tradeAccountId: string,
  invoiceId: string,
): Promise<void> {
  try {
    const connections = await listAccountingConnections(db, tradeAccountId)
    const conn = connections.find(isConnectionReady) ?? null
    if (!conn) return
    await pushInvoiceWithConnection(db, env, conn, invoiceId)
  } catch (e) {
    Sentry.captureException(e, {
      tags: { feature: 'pouriq-accounting-push', provider: 'unknown' },
      extra: { invoiceId },
    })
  }
}

/** Hourly: re-attempt failed pushes and back-fill invoices committed while
 *  disconnected or half-set-up. Only invoices committed after the
 *  connection was created are considered. */
export async function runAccountingPushSweep(
  env: { DB: D1Database } & AccountingProvidersEnv,
): Promise<void> {
  try {
    const db = env.DB
    const result = await db
      .prepare(`SELECT * FROM pouriq_accounting_connections WHERE enabled = 1`)
      .all<AccountingConnection>()
    for (const conn of result.results ?? []) {
      if (!isConnectionReady(conn)) continue
      try {
        const pending = await db
          .prepare(`
            SELECT i.id FROM pouriq_invoices i
            LEFT JOIN pouriq_accounting_pushes p ON p.invoice_id = i.id AND p.provider = ?1
            WHERE i.trade_account_id = ?2
              AND i.created_at >= ?3
              AND (p.id IS NULL OR p.status = 'failed')
            ORDER BY i.created_at ASC
            LIMIT ${SWEEP_BATCH_LIMIT}
          `)
          .bind(conn.provider, conn.trade_account_id, conn.created_at)
          .all<{ id: string }>()
        for (const row of pending.results ?? []) {
          const outcome = await pushInvoiceWithConnection(db, env, conn, row.id)
          // The connection is now enabled = 0; abandon its batch so we do not
          // hammer a revoked token. Future sweeps skip it via WHERE enabled = 1.
          if (outcome === 'auth-failed') break
        }
      } catch (e) {
        Sentry.captureException(e, { tags: { feature: 'pouriq-accounting-sweep', provider: conn.provider } })
      }
    }
  } catch (e) {
    // An unapplied migration would otherwise throw hourly into waitUntil
    // with no Sentry event.
    Sentry.captureException(e, { tags: { feature: 'pouriq-accounting-sweep', provider: 'unknown' } })
  }
}
