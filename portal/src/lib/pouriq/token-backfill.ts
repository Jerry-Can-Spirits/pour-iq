// One-off-with-a-safety-net backfill: encrypt any OAuth token rows the
// compliance hardening left in plaintext. That PR encrypted on write
// only (decryptToken passes legacy plaintext through), so rows survive
// unencrypted until their connection next refreshes a token — this
// sweep closes that window. Idempotent: once every row carries the
// enc:v1 prefix the SELECT matches nothing. Runs from the hourly cron,
// which primes the token key first (no request context there).

import { encryptToken, isEncryptedToken } from './token-crypto'

const CONNECTION_TABLES = ['pouriq_pos_connections', 'pouriq_accounting_connections'] as const

interface TokenRow {
  id: string
  access_token: string
  refresh_token: string | null
}

export async function runTokenBackfill(env: {
  DB: D1Database
  TOKEN_ENCRYPTION_KEY?: string
}): Promise<void> {
  if (!env.TOKEN_ENCRYPTION_KEY) return

  for (const table of CONNECTION_TABLES) {
    const { results } = await env.DB.prepare(
      `SELECT id, access_token, refresh_token FROM ${table}
       WHERE access_token NOT LIKE 'enc:v1:%'
          OR (refresh_token IS NOT NULL AND refresh_token NOT LIKE 'enc:v1:%')`,
    ).all<TokenRow>()

    for (const row of results) {
      const access = isEncryptedToken(row.access_token)
        ? row.access_token
        : await encryptToken(row.access_token)
      const refresh =
        row.refresh_token === null || isEncryptedToken(row.refresh_token)
          ? row.refresh_token
          : await encryptToken(row.refresh_token)
      // The access_token = ?4 guard skips rows a live OAuth refresh
      // rewrote between the SELECT and this UPDATE.
      await env.DB.prepare(
        `UPDATE ${table} SET access_token = ?1, refresh_token = ?2 WHERE id = ?3 AND access_token = ?4`,
      )
        .bind(access, refresh, row.id, row.access_token)
        .run()
    }
  }
}
