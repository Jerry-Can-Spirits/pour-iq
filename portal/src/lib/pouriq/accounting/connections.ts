import type { AccountingConnection, AccountingProvider, AccountingTokenSet } from './types'

export interface NewAccountingConnection {
  trade_account_id: string
  provider: AccountingProvider
  external_account_id: string
  external_account_name: string | null
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
}

export async function upsertAccountingConnection(
  db: D1Database,
  data: NewAccountingConnection,
): Promise<string> {
  const result = await db
    .prepare(`
      INSERT INTO pouriq_accounting_connections
        (trade_account_id, provider, external_account_id, external_account_name,
         access_token, refresh_token, token_expires_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      ON CONFLICT(trade_account_id, provider) DO UPDATE SET
        external_account_id = excluded.external_account_id,
        external_account_name = excluded.external_account_name,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        token_expires_at = excluded.token_expires_at,
        last_push_error = NULL,
        enabled = 1,
        updated_at = datetime('now')
      RETURNING id
    `)
    .bind(
      data.trade_account_id, data.provider, data.external_account_id, data.external_account_name,
      data.access_token, data.refresh_token, data.token_expires_at,
    )
    .first<{ id: string }>()
  if (!result) throw new Error('Accounting connection upsert returned no id')
  return result.id
}

export async function getAccountingConnection(
  db: D1Database,
  tradeAccountId: string,
  provider: AccountingProvider,
): Promise<AccountingConnection | null> {
  return await db
    .prepare(`SELECT * FROM pouriq_accounting_connections WHERE trade_account_id = ?1 AND provider = ?2`)
    .bind(tradeAccountId, provider)
    .first<AccountingConnection>()
}

export async function listAccountingConnections(
  db: D1Database,
  tradeAccountId: string,
): Promise<AccountingConnection[]> {
  const result = await db
    .prepare(`SELECT * FROM pouriq_accounting_connections WHERE trade_account_id = ?1`)
    .bind(tradeAccountId)
    .all<AccountingConnection>()
  return result.results ?? []
}

export async function deleteAccountingConnection(
  db: D1Database,
  tradeAccountId: string,
  provider: AccountingProvider,
): Promise<void> {
  await db
    .prepare(`DELETE FROM pouriq_accounting_connections WHERE trade_account_id = ?1 AND provider = ?2`)
    .bind(tradeAccountId, provider)
    .run()
}

export async function updateAccountingTokens(
  db: D1Database,
  connectionId: string,
  tokens: AccountingTokenSet,
): Promise<void> {
  await db
    .prepare(`
      UPDATE pouriq_accounting_connections
      SET access_token = ?1,
          refresh_token = COALESCE(?2, refresh_token),
          token_expires_at = ?3,
          updated_at = datetime('now')
      WHERE id = ?4
    `)
    .bind(tokens.accessToken, tokens.refreshToken, tokens.expiresAt, connectionId)
    .run()
}

export interface AccountingSetup {
  external_account_id?: string
  external_account_name?: string | null
  default_account_code: string
  default_tax_code: string
}

export async function saveAccountingSetup(
  db: D1Database,
  tradeAccountId: string,
  provider: AccountingProvider,
  setup: AccountingSetup,
): Promise<void> {
  await db
    .prepare(`
      UPDATE pouriq_accounting_connections
      SET external_account_id = COALESCE(?1, external_account_id),
          external_account_name = COALESCE(?2, external_account_name),
          default_account_code = ?3,
          default_tax_code = ?4,
          updated_at = datetime('now')
      WHERE trade_account_id = ?5 AND provider = ?6
    `)
    .bind(
      setup.external_account_id ?? null, setup.external_account_name ?? null,
      setup.default_account_code, setup.default_tax_code,
      tradeAccountId, provider,
    )
    .run()
}

export async function markAccountingPushSuccess(db: D1Database, connectionId: string): Promise<void> {
  await db
    .prepare(`UPDATE pouriq_accounting_connections SET last_push_at = datetime('now'), last_push_error = NULL WHERE id = ?1`)
    .bind(connectionId)
    .run()
}

export async function markAccountingPushError(db: D1Database, connectionId: string, error: string): Promise<void> {
  await db
    .prepare(`UPDATE pouriq_accounting_connections SET last_push_error = ?1 WHERE id = ?2`)
    .bind(error.slice(0, 500), connectionId)
    .run()
}

/** Auth failure (revoked/expired refresh token): pause pushing entirely.
 *  Reconnecting re-enables via the upsert (enabled = 1, error cleared). */
export async function markAccountingAuthFailure(db: D1Database, connectionId: string, error: string): Promise<void> {
  await db
    .prepare(`UPDATE pouriq_accounting_connections SET enabled = 0, last_push_error = ?1, updated_at = datetime('now') WHERE id = ?2`)
    .bind(error.slice(0, 500), connectionId)
    .run()
}

/** Fully set up and enabled: pushing is held until this is true, so a
 *  half-configured connection queues invoices rather than mis-coding them. */
export function isConnectionReady(conn: AccountingConnection): boolean {
  return conn.enabled === 1
    && conn.external_account_id !== ''
    && conn.default_account_code !== null
    && conn.default_tax_code !== null
}

// OAuth state nonces reuse pouriq_pos_oauth_states: it is provider-agnostic
// CSRF plumbing (state PK, plain-TEXT provider, 10 minute TTL).

export async function createAccountingOAuthState(
  db: D1Database,
  tradeAccountId: string,
  provider: AccountingProvider,
): Promise<string> {
  const state = crypto.randomUUID()
  await db
    .prepare(`INSERT INTO pouriq_pos_oauth_states (state, trade_account_id, provider) VALUES (?1, ?2, ?3)`)
    .bind(state, tradeAccountId, provider)
    .run()
  return state
}

export async function consumeAccountingOAuthState(
  db: D1Database,
  state: string,
): Promise<{ trade_account_id: string; provider: string } | null> {
  const row = await db
    .prepare(`SELECT trade_account_id, provider FROM pouriq_pos_oauth_states WHERE state = ?1 AND datetime(created_at) > datetime('now', '-10 minutes')`)
    .bind(state)
    .first<{ trade_account_id: string; provider: string }>()
  if (row) {
    await db.prepare(`DELETE FROM pouriq_pos_oauth_states WHERE state = ?1`).bind(state).run()
  }
  return row
}
