// Automated data-retention enforcement, implementing the published policy
// (privacy policy §6): platform data is retained for the life of the
// licence plus two years, then deleted — except supplier invoice records,
// which are retained six years from their invoice date in line with HMRC
// record keeping, then deleted. Runs daily from the scheduled worker entry.
//
// Stage 1 (two years after the last licence expired): delete all venue
// data except the invoice records. Deleting the ingredient library is safe
// for the purchase record: invoice_lines.matched_library_id is ON DELETE
// SET NULL (the extracted line text is the record), and the derived tables
// (cost changes, serve units, uses, prepared components) cascade away.
// The account row is kept as a scrubbed tombstone so invoice FKs resolve.
//
// Stage 2 (invoices older than six years, tombstoned accounts only):
// delete the invoice rows, their lines, and the archived PDF in R2.
//
// Stage 3: a tombstone with no invoices left is removed entirely.

const TOMBSTONE_NAME = 'Deleted venue (retention policy)'

interface RetentionEnv {
  DB: D1Database
  TRADE_DOCS: R2Bucket
}

async function lapsedAccountIds(db: D1Database): Promise<string[]> {
  // Accounts whose newest licence ended more than two years ago and that
  // have not already been tombstoned.
  const rows = await db
    .prepare(`
      SELECT a.id FROM trade_accounts a
      WHERE a.venue_name != ?1
        AND NOT EXISTS (
          SELECT 1 FROM pouriq_subscriptions s
          WHERE s.trade_account_id = a.id
            AND datetime(s.valid_until) > datetime('now', '-2 years')
        )
        AND EXISTS (SELECT 1 FROM pouriq_subscriptions s WHERE s.trade_account_id = a.id)
    `)
    .bind(TOMBSTONE_NAME)
    .all<{ id: string }>()
  return (rows.results ?? []).map((r) => r.id)
}

async function purgeVenueData(db: D1Database, accountId: string): Promise<void> {
  const run = (sql: string) => db.prepare(sql).bind(accountId).run()

  // POS surface: children first (no cascade declared on connection_id refs).
  await run(`DELETE FROM pouriq_pos_seen_orders WHERE connection_id IN (SELECT id FROM pouriq_pos_connections WHERE trade_account_id = ?1)`)
  await run(`DELETE FROM pouriq_pos_unmatched_lines WHERE connection_id IN (SELECT id FROM pouriq_pos_connections WHERE trade_account_id = ?1)`)
  await run(`DELETE FROM pouriq_pos_connections WHERE trade_account_id = ?1`)
  await run(`DELETE FROM pouriq_pos_oauth_states WHERE trade_account_id = ?1`)
  await run(`DELETE FROM pouriq_pos_item_map WHERE trade_account_id = ?1`)
  await run(`DELETE FROM pouriq_accounting_pushes WHERE invoice_id IN (SELECT id FROM pouriq_invoices WHERE trade_account_id = ?1)`)
  await run(`DELETE FROM pouriq_accounting_connections WHERE trade_account_id = ?1`)

  // Menus cascade cocktails, ingredients, sections, analyses, volumes,
  // stock counts. Stock and production are account-scoped.
  await run(`DELETE FROM pouriq_menus WHERE trade_account_id = ?1`)
  await run(`DELETE FROM pouriq_stock_count_events WHERE trade_account_id = ?1`)
  await run(`DELETE FROM pouriq_stock_receipts WHERE trade_account_id = ?1`)
  await run(`DELETE FROM pouriq_production_components WHERE production_event_id IN (SELECT id FROM pouriq_production_events WHERE trade_account_id = ?1)`)
  await run(`DELETE FROM pouriq_production_events WHERE trade_account_id = ?1`)
  await run(`DELETE FROM pouriq_voice_profiles WHERE trade_account_id = ?1`)

  // Library last: cascades cost changes, serve units, uses, prepared
  // components; invoice lines SET NULL and keep their extracted text.
  await run(`DELETE FROM pouriq_ingredients_library WHERE trade_account_id = ?1`)

  // Tombstone the account: PII scrubbed, login disabled, row retained so
  // the six-year invoice records keep a valid FK target.
  await db
    .prepare(`UPDATE trade_accounts SET venue_name = ?1, pin = 'purged-' || id, discount_code = '', active = 0 WHERE id = ?2`)
    .bind(TOMBSTONE_NAME, accountId)
    .run()
}

async function purgeExpiredInvoices(env: RetentionEnv): Promise<void> {
  const db = env.DB
  const rows = await db
    .prepare(`
      SELECT i.id, i.r2_key FROM pouriq_invoices i
      JOIN trade_accounts a ON a.id = i.trade_account_id
      WHERE a.venue_name = ?1
        AND datetime(COALESCE(i.invoice_date, i.created_at)) < datetime('now', '-6 years')
    `)
    .bind(TOMBSTONE_NAME)
    .all<{ id: string; r2_key: string | null }>()

  for (const invoice of rows.results ?? []) {
    if (invoice.r2_key) {
      try {
        await env.TRADE_DOCS.delete(invoice.r2_key)
      } catch {
        // Best effort — the DB record is the retention obligation.
      }
    }
    await db.prepare(`DELETE FROM pouriq_invoice_lines WHERE invoice_id = ?1`).bind(invoice.id).run()
    await db.prepare(`DELETE FROM pouriq_invoices WHERE id = ?1`).bind(invoice.id).run()
  }
}

async function removeEmptyTombstones(db: D1Database): Promise<void> {
  await db
    .prepare(`DELETE FROM pouriq_subscriptions WHERE trade_account_id IN (
      SELECT a.id FROM trade_accounts a WHERE a.venue_name = ?1
        AND NOT EXISTS (SELECT 1 FROM pouriq_invoices i WHERE i.trade_account_id = a.id)
    )`)
    .bind(TOMBSTONE_NAME)
    .run()
  await db
    .prepare(`DELETE FROM trade_accounts WHERE venue_name = ?1
      AND NOT EXISTS (SELECT 1 FROM pouriq_invoices i WHERE i.trade_account_id = trade_accounts.id)`)
    .bind(TOMBSTONE_NAME)
    .run()
}

export async function runRetentionSweep(env: RetentionEnv): Promise<void> {
  const lapsed = await lapsedAccountIds(env.DB)
  for (const id of lapsed) {
    await purgeVenueData(env.DB, id)
  }
  await purgeExpiredInvoices(env)
  await removeEmptyTombstones(env.DB)
}
