import type { PosAuthMode, PosConnection, PosProvider } from './types'

export interface NewConnection {
  trade_account_id: string
  provider: PosProvider
  external_account_id: string
  external_location_id: string | null
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  scopes: string | null
  auth_mode?: PosAuthMode
}

export async function upsertConnection(
  db: D1Database,
  data: NewConnection,
): Promise<string> {
  const result = await db
    .prepare(`
      INSERT INTO pouriq_pos_connections
        (trade_account_id, provider, external_account_id, external_location_id,
         access_token, refresh_token, token_expires_at, scopes, auth_mode)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      ON CONFLICT(trade_account_id, provider) DO UPDATE SET
        external_account_id = excluded.external_account_id,
        external_location_id = excluded.external_location_id,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        token_expires_at = excluded.token_expires_at,
        scopes = excluded.scopes,
        auth_mode = excluded.auth_mode,
        last_sync_error = NULL,
        enabled = 1,
        updated_at = datetime('now')
      RETURNING id
    `)
    .bind(
      data.trade_account_id, data.provider, data.external_account_id, data.external_location_id,
      data.access_token, data.refresh_token, data.token_expires_at, data.scopes,
      data.auth_mode ?? 'oauth',
    )
    .first<{ id: string }>()
  if (!result) throw new Error('Connection upsert returned no id')
  return result.id
}

export async function getConnection(
  db: D1Database,
  tradeAccountId: string,
  provider: PosProvider,
): Promise<PosConnection | null> {
  return await db
    .prepare(`SELECT * FROM pouriq_pos_connections WHERE trade_account_id = ?1 AND provider = ?2`)
    .bind(tradeAccountId, provider)
    .first<PosConnection>()
}

export async function listConnections(
  db: D1Database,
  tradeAccountId: string,
): Promise<PosConnection[]> {
  const result = await db
    .prepare(`SELECT * FROM pouriq_pos_connections WHERE trade_account_id = ?1`)
    .bind(tradeAccountId)
    .all<PosConnection>()
  return result.results ?? []
}

export async function findConnectionByExternalAccount(
  db: D1Database,
  provider: PosProvider,
  externalAccountId: string,
): Promise<PosConnection | null> {
  return await db
    .prepare(`SELECT * FROM pouriq_pos_connections WHERE provider = ?1 AND external_account_id = ?2`)
    .bind(provider, externalAccountId)
    .first<PosConnection>()
}

export async function deleteConnection(
  db: D1Database,
  tradeAccountId: string,
  provider: PosProvider,
): Promise<void> {
  await db
    .prepare(`DELETE FROM pouriq_pos_connections WHERE trade_account_id = ?1 AND provider = ?2`)
    .bind(tradeAccountId, provider)
    .run()
}

export async function updateConnectionTokens(
  db: D1Database,
  connectionId: string,
  tokens: { accessToken: string; refreshToken: string | null; expiresAt: string | null },
): Promise<void> {
  await db
    .prepare(`
      UPDATE pouriq_pos_connections
      SET access_token = ?1,
          refresh_token = COALESCE(?2, refresh_token),
          token_expires_at = ?3,
          updated_at = datetime('now')
      WHERE id = ?4
    `)
    .bind(tokens.accessToken, tokens.refreshToken, tokens.expiresAt, connectionId)
    .run()
}

export async function markSyncSuccess(
  db: D1Database,
  connectionId: string,
): Promise<void> {
  await db
    .prepare(`UPDATE pouriq_pos_connections SET last_synced_at = datetime('now'), last_sync_error = NULL WHERE id = ?1`)
    .bind(connectionId)
    .run()
}

export async function markSyncError(
  db: D1Database,
  connectionId: string,
  error: string,
): Promise<void> {
  await db
    .prepare(`UPDATE pouriq_pos_connections SET last_sync_error = ?1 WHERE id = ?2`)
    .bind(error.slice(0, 500), connectionId)
    .run()
}

export async function consumeOAuthState(
  db: D1Database,
  state: string,
): Promise<{ trade_account_id: string; provider: PosProvider } | null> {
  const row = await db
    .prepare(`SELECT trade_account_id, provider FROM pouriq_pos_oauth_states WHERE state = ?1 AND datetime(created_at) > datetime('now', '-10 minutes')`)
    .bind(state)
    .first<{ trade_account_id: string; provider: PosProvider }>()
  if (row) {
    await db.prepare(`DELETE FROM pouriq_pos_oauth_states WHERE state = ?1`).bind(state).run()
  }
  return row
}

export async function createOAuthState(
  db: D1Database,
  tradeAccountId: string,
  provider: PosProvider,
): Promise<string> {
  const state = crypto.randomUUID()
  await db
    .prepare(`INSERT INTO pouriq_pos_oauth_states (state, trade_account_id, provider) VALUES (?1, ?2, ?3)`)
    .bind(state, tradeAccountId, provider)
    .run()
  return state
}
