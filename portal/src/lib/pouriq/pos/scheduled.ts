// Hourly cron: poll every active connection for orders since its
// last_synced_at. Idempotent — ingestOrderLines dedupes at order level
// via pouriq_pos_seen_orders, so the one-hour overlap window below and
// webhook/cron overlap never double-count.

import { getAdapterForProvider, type ProvidersEnv } from './providers'
import { ingestOrderLines } from './ingest'
import { markSyncSuccess, markSyncError, updateConnectionTokens } from './connections'
import type { PosConnection } from './types'

// Refresh access tokens this far before they expire. Square access
// tokens last 30 days; refreshing inside a week keeps a healthy margin
// over cron downtime. Short-lived tokens (Zettle, ~2 hours) simply
// refresh on every run, which is correct.
const TOKEN_REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

type Env = { DB: D1Database } & ProvidersEnv

export async function runHourlyPosBackfill(env: Env): Promise<void> {
  const db = env.DB
  const result = await db
    .prepare(`SELECT * FROM pouriq_pos_connections WHERE enabled = 1`)
    .all<PosConnection>()
  const connections = result.results ?? []
  for (const conn of connections) {
    try {
      const adapter = getAdapterForProvider(conn.provider, env)
      if (!adapter) continue

      // Refresh the access token before it expires; a lapsed token
      // would fail every sync until the venue reconnects manually.
      if (adapter.authMode === 'oauth' && adapter.refreshAccessToken && conn.refresh_token && conn.token_expires_at) {
        const expiresAt = new Date(conn.token_expires_at).getTime()
        if (Number.isFinite(expiresAt) && expiresAt - Date.now() < TOKEN_REFRESH_WINDOW_MS) {
          const refreshed = await adapter.refreshAccessToken(conn.refresh_token)
          await updateConnectionTokens(db, conn.id, refreshed)
          conn.access_token = refreshed.accessToken
          conn.refresh_token = refreshed.refreshToken ?? conn.refresh_token
          conn.token_expires_at = refreshed.expiresAt
        }
      }

      const since = conn.last_synced_at
        ? new Date(new Date(conn.last_synced_at).getTime() - 60 * 60 * 1000)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const lines = await adapter.fetchOrdersSince(conn, since)
      const result = await ingestOrderLines(db, conn, lines)
      if (!result.paused) {
        await markSyncSuccess(db, conn.id)
      }
    } catch (e) {
      await markSyncError(db, conn.id, (e as Error).message ?? 'unknown').catch(() => {})
    }
  }
}
