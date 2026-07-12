import type { PosAdapter, PosOrderLine } from '../types'

const OAUTH_BASE = 'https://oauth.zettle.com'
const PURCHASE_BASE = 'https://purchase.izettle.com'

export interface ZettleEnv {
  ZETTLE_CLIENT_ID: string
  ZETTLE_CLIENT_SECRET: string
}

interface ZettlePurchase {
  purchaseUUID: string
  timestamp: string
  refund?: boolean
  products?: Array<{
    name?: string
    variantName?: string
    quantity?: string
    unitPrice?: number
  }>
}

function toExpiryIso(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString()
}

export function createZettleAdapter(env: ZettleEnv): PosAdapter {
  async function tokenRequest(body: URLSearchParams) {
    const res = await fetch(`${OAUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) throw new Error(`Zettle token ${res.status}`)
    return await res.json() as {
      access_token: string
      refresh_token?: string
      expires_in: number
    }
  }

  return {
    provider: 'zettle',
    authMode: 'oauth',

    async exchangeCodeForToken(code, redirectUri) {
      const data = await tokenRequest(new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: env.ZETTLE_CLIENT_ID,
        client_secret: env.ZETTLE_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }))
      // Resolve the organisation for external_account_id.
      const meRes = await fetch(`${OAUTH_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      })
      if (!meRes.ok) throw new Error(`Zettle users/me ${meRes.status}`)
      const me = await meRes.json() as { organizationUuid?: string; uuid?: string }
      const externalAccountId = me.organizationUuid ?? me.uuid
      if (!externalAccountId) throw new Error('Zettle users/me returned no organisation id')
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiresAt: toExpiryIso(data.expires_in),
        scopes: 'READ:PURCHASE',
        externalAccountId,
        externalLocationId: null,
      }
    },

    async refreshAccessToken(refreshToken) {
      const data = await tokenRequest(new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.ZETTLE_CLIENT_ID,
        client_secret: env.ZETTLE_CLIENT_SECRET,
        refresh_token: refreshToken,
      }))
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiresAt: toExpiryIso(data.expires_in),
      }
    },

    async fetchOrdersSince(connection, since) {
      const lines: PosOrderLine[] = []
      let lastPurchaseHash: string | undefined
      do {
        const params = new URLSearchParams({
          startDate: since.toISOString(),
          descending: 'false',
          limit: '200',
        })
        if (lastPurchaseHash) params.set('lastPurchaseHash', lastPurchaseHash)
        const res = await fetch(`${PURCHASE_BASE}/purchases/v2?${params.toString()}`, {
          headers: { Authorization: `Bearer ${connection.access_token}` },
        })
        if (!res.ok) throw new Error(`Zettle purchases ${res.status}`)
        const data = await res.json() as {
          purchases?: ZettlePurchase[]
          lastPurchaseHash?: string
        }
        const purchases = data.purchases ?? []
        for (const purchase of purchases) {
          // Refunds are skipped in v1, matching Square v1 (COMPLETED orders only).
          if (purchase.refund) continue
          for (const product of purchase.products ?? []) {
            if (!product.name) continue
            const quantity = parseFloat(product.quantity ?? '1') || 1
            const variant = product.variantName?.trim()
            lines.push({
              external_order_id: purchase.purchaseUUID,
              external_item_id: null,
              name: variant && variant.toLowerCase() !== 'regular' ? `${product.name} ${variant}` : product.name,
              quantity,
              sold_at: purchase.timestamp,
              gross_amount_p: Math.round((product.unitPrice ?? 0) * quantity),
            })
          }
        }
        lastPurchaseHash = purchases.length > 0 ? data.lastPurchaseHash : undefined
      } while (lastPurchaseHash)
      return lines
    },

    // No webhooks in v1 — hourly cron polling only. Zettle push
    // subscriptions are a documented fast-follow.
    async verifyWebhook() {
      return false
    },
    parseWebhookPayload() {
      return []
    },
  }
}
