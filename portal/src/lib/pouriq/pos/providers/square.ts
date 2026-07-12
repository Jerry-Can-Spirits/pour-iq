import type { PosAdapter, PosOrderLine } from '../types'

const SQUARE_VERSION = '2026-01-22'

// Constant-time string comparison for webhook signatures.
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export interface SquareEnv {
  SQUARE_APP_ID: string
  SQUARE_APP_SECRET: string
  SQUARE_WEBHOOK_SIGNATURE_KEY: string
  SQUARE_ENV?: string
}

export function getSquareBaseUrl(env: Pick<SquareEnv, 'SQUARE_ENV'>): string {
  return env.SQUARE_ENV?.trim().toLowerCase() === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com'
}

export function createSquareAdapter(env: SquareEnv): PosAdapter {
  const baseUrl = getSquareBaseUrl(env)
  const tokenUrl = `${baseUrl}/oauth2/token`
  const ordersSearchUrl = `${baseUrl}/v2/orders/search`
  const locationsUrl = `${baseUrl}/v2/locations`

  return {
    provider: 'square',
    authMode: 'oauth',

    async exchangeCodeForToken(code, redirectUri) {
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Square-Version': SQUARE_VERSION },
        body: JSON.stringify({
          client_id: env.SQUARE_APP_ID,
          client_secret: env.SQUARE_APP_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Square OAuth ${res.status}: ${errText}`)
      }
      const data = await res.json() as {
        access_token: string
        refresh_token: string
        expires_at: string
        merchant_id: string
        token_type: string
      }
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        scopes: 'ORDERS_READ,ITEMS_READ,MERCHANT_PROFILE_READ',
        externalAccountId: data.merchant_id,
        externalLocationId: null,  // resolved on first fetch
      }
    },

    async refreshAccessToken(refreshToken) {
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Square-Version': SQUARE_VERSION },
        body: JSON.stringify({
          client_id: env.SQUARE_APP_ID,
          client_secret: env.SQUARE_APP_SECRET,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })
      if (!res.ok) throw new Error(`Square refresh ${res.status}`)
      const data = await res.json() as {
        access_token: string
        refresh_token: string
        expires_at: string
      }
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
      }
    },

    async fetchOrdersSince(connection, since) {
      const lines: PosOrderLine[] = []
      let cursor: string | undefined
      // location-scoped search; first fetch resolves location if missing
      const locationIds = connection.external_location_id
        ? [connection.external_location_id]
        : await resolveAllLocations(locationsUrl, connection.access_token)
      do {
        const res = await fetch(ordersSearchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${connection.access_token}`,
            'Square-Version': SQUARE_VERSION,
          },
          body: JSON.stringify({
            location_ids: locationIds,
            query: {
              filter: {
                state_filter: { states: ['COMPLETED'] },
                date_time_filter: {
                  closed_at: { start_at: since.toISOString() },
                },
              },
              sort: { sort_field: 'CLOSED_AT', sort_order: 'ASC' },
            },
            limit: 200,
            cursor,
          }),
        })
        if (!res.ok) throw new Error(`Square orders ${res.status}`)
        const data = await res.json() as {
          orders?: Array<{
            id: string
            closed_at?: string
            line_items?: Array<{
              uid: string
              name: string
              quantity: string
              catalog_object_id?: string
              gross_sales_money?: { amount: number; currency: string }
            }>
          }>
          cursor?: string
        }
        for (const order of data.orders ?? []) {
          if (!order.closed_at) continue
          for (const li of order.line_items ?? []) {
            lines.push({
              external_order_id: order.id,
              external_item_id: li.catalog_object_id ?? null,
              name: li.name,
              quantity: parseFloat(li.quantity) || 1,
              sold_at: order.closed_at,
              gross_amount_p: li.gross_sales_money?.amount ?? 0,
            })
          }
        }
        cursor = data.cursor
      } while (cursor)
      return lines
    },

    async verifyWebhook(request, body) {
      const signature = request.headers.get('X-Square-HmacSha256-Signature')
      if (!signature) return false
      const url = request.url
      const keyData = new TextEncoder().encode(env.SQUARE_WEBHOOK_SIGNATURE_KEY)
      const messageData = new TextEncoder().encode(url + body)
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
      )
      const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
      const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
      return timingSafeEqualStr(sigBase64, signature)
    },

    async revokeToken(accessToken) {
      const res = await fetch(`${baseUrl}/oauth2/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Square-Version': SQUARE_VERSION,
          'Authorization': `Client ${env.SQUARE_APP_SECRET}`,
        },
        body: JSON.stringify({ client_id: env.SQUARE_APP_ID, access_token: accessToken }),
      })
      if (!res.ok) throw new Error(`Square revoke ${res.status}`)
    },

    parseWebhookPayload(payload) {
      // Square webhook payload shape:
      // { merchant_id, type, event_id, created_at, data: { type: 'order', id, object: { order: {...} } } }
      const p = payload as {
        type?: string
        data?: { object?: { order?: {
          id: string
          state?: string
          closed_at?: string
          line_items?: Array<{
            name: string
            quantity: string
            catalog_object_id?: string
            gross_sales_money?: { amount: number }
          }>
        } } }
      }
      const order = p.data?.object?.order
      if (!order || order.state !== 'COMPLETED' || !order.closed_at) return []
      return (order.line_items ?? []).map((li) => ({
        external_order_id: order.id,
        external_item_id: li.catalog_object_id ?? null,
        name: li.name,
        quantity: parseFloat(li.quantity) || 1,
        sold_at: order.closed_at!,
        gross_amount_p: li.gross_sales_money?.amount ?? 0,
      }))
    },
  }
}

async function resolveAllLocations(locationsUrl: string, accessToken: string): Promise<string[]> {
  const res = await fetch(locationsUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Square-Version': SQUARE_VERSION,
    },
  })
  if (!res.ok) throw new Error(`Square locations ${res.status}`)
  const data = await res.json() as { locations?: Array<{ id: string; status?: string }> }
  return (data.locations ?? []).filter((l) => l.status !== 'INACTIVE').map((l) => l.id)
}
