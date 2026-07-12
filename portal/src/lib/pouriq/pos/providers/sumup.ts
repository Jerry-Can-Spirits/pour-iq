import type { PosAdapter, PosOrderLine } from '../types'

const API_BASE = 'https://api.sumup.com'

export interface SumUpEnv {
  SUMUP_CLIENT_ID: string
  SUMUP_CLIENT_SECRET: string
}

interface SumUpHistoryItem {
  id?: string
  status?: string
}

interface SumUpLink {
  rel?: string
  href?: string
}

interface SumUpTransactionDetail {
  id?: string
  timestamp?: string
  status?: string
  products?: Array<{
    name?: string
    quantity?: number
    total_price?: number
  }>
}

function toExpiryIso(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString()
}

export function createSumUpAdapter(env: SumUpEnv): PosAdapter {
  async function tokenRequest(body: URLSearchParams) {
    const res = await fetch(`${API_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) throw new Error(`SumUp token ${res.status}`)
    return await res.json() as {
      access_token: string
      refresh_token?: string
      expires_in: number
    }
  }

  return {
    provider: 'sumup',
    authMode: 'oauth',

    async exchangeCodeForToken(code, redirectUri) {
      const data = await tokenRequest(new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: env.SUMUP_CLIENT_ID,
        client_secret: env.SUMUP_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }))
      // The merchant_code is required in every transactions path.
      const meRes = await fetch(`${API_BASE}/v0.1/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      })
      if (!meRes.ok) throw new Error(`SumUp me ${meRes.status}`)
      const me = await meRes.json() as { merchant_profile?: { merchant_code?: string } }
      const merchantCode = me.merchant_profile?.merchant_code
      if (!merchantCode) throw new Error('SumUp me returned no merchant_code')
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiresAt: toExpiryIso(data.expires_in),
        scopes: 'transactions.history user.profile_readonly',
        externalAccountId: merchantCode,
        externalLocationId: null,
      }
    },

    async refreshAccessToken(refreshToken) {
      const data = await tokenRequest(new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.SUMUP_CLIENT_ID,
        client_secret: env.SUMUP_CLIENT_SECRET,
        refresh_token: refreshToken,
      }))
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiresAt: toExpiryIso(data.expires_in),
      }
    },

    async fetchOrdersSince(connection, since) {
      const merchantCode = connection.external_account_id
      const auth = { Authorization: `Bearer ${connection.access_token}` }

      // 1. List completed transactions in the window. The history endpoint
      //    returns summaries only (no line items) and paginates via the
      //    `links` next href, which we follow verbatim to avoid guessing
      //    cursor params.
      const summaries: SumUpHistoryItem[] = []
      let nextPath: string | null =
        `/v2.1/merchants/${merchantCode}/transactions/history?limit=100&oldest_time=${encodeURIComponent(since.toISOString())}`
      while (nextPath) {
        const res = await fetch(`${API_BASE}${nextPath}`, { headers: auth })
        if (!res.ok) throw new Error(`SumUp history ${res.status}`)
        const data = await res.json() as { items?: SumUpHistoryItem[]; links?: SumUpLink[] }
        for (const item of data.items ?? []) summaries.push(item)
        const next = (data.links ?? []).find((l) => l.rel === 'next')?.href
        nextPath = next ?? null
      }

      // 2. Hydrate each successful transaction to read its products[].
      const lines: PosOrderLine[] = []
      for (const summary of summaries) {
        if (summary.status !== 'SUCCESSFUL' || !summary.id) continue
        const res = await fetch(
          `${API_BASE}/v2.1/merchants/${merchantCode}/transactions?id=${encodeURIComponent(summary.id)}`,
          { headers: auth },
        )
        if (!res.ok) throw new Error(`SumUp transaction ${res.status}`)
        const txn = await res.json() as SumUpTransactionDetail
        if (txn.status !== 'SUCCESSFUL' || !txn.timestamp) continue
        for (const product of txn.products ?? []) {
          if (!product.name) continue
          const quantity = product.quantity ?? 1
          lines.push({
            external_order_id: txn.id ?? summary.id,
            external_item_id: null,
            name: product.name,
            quantity,
            sold_at: txn.timestamp,
            // SumUp amounts are major-unit decimals (e.g. 10.1 = £10.10).
            gross_amount_p: Math.round((product.total_price ?? 0) * 100),
          })
        }
      }
      return lines
    },

    // No webhooks in v1 — hourly cron polling only. SumUp's Pusher API is
    // a documented fast-follow.
    async verifyWebhook() {
      return false
    },
    parseWebhookPayload() {
      return []
    },
  }
}
