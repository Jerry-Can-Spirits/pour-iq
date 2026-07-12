// Shared types for POS integrations. Provider-agnostic so Lightspeed
// and ePOSnow can drop into the same architecture in later sprints.

export type PosProvider = 'square' | 'zettle' | 'sumup' | 'tevalis' | 'eposnow' | 'lightspeed' | 'toast'

export type PosAuthMode = 'oauth' | 'api-key'

const KNOWN_PROVIDERS: readonly PosProvider[] = ['square', 'zettle', 'sumup', 'tevalis', 'eposnow', 'lightspeed', 'toast']

export function isKnownProvider(p: string): p is PosProvider {
  return (KNOWN_PROVIDERS as readonly string[]).includes(p)
}

export interface PosConnection {
  id: string
  trade_account_id: string
  provider: PosProvider
  external_account_id: string
  external_location_id: string | null
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  scopes: string | null
  last_synced_at: string | null
  last_sync_error: string | null
  enabled: number
  auth_mode: PosAuthMode
  target_menu_id: string | null
  created_at: string
  updated_at: string
}

// Normalised order line that adapters return after parsing a
// provider-specific payload. Pour IQ then matches name → cocktail
// and upserts volume.
export interface PosOrderLine {
  external_order_id: string
  external_item_id: string | null
  name: string
  quantity: number
  sold_at: string  // ISO datetime
  gross_amount_p: number  // pence
}

// What every adapter must implement.
export interface PosAdapter {
  provider: PosProvider
  authMode: PosAuthMode
  /** OAuth adapters only. */
  exchangeCodeForToken?(code: string, redirectUri: string): Promise<{
    accessToken: string
    refreshToken: string | null
    expiresAt: string | null
    scopes: string | null
    externalAccountId: string
    externalLocationId: string | null
  }>
  /** OAuth adapters only. */
  refreshAccessToken?(refreshToken: string): Promise<{
    accessToken: string
    refreshToken: string | null
    expiresAt: string | null
  }>
  /** Api-key adapters only: verify credentials against the provider, return account identity. */
  validateCredentials?(fields: Record<string, string>): Promise<{
    externalAccountId: string
    externalLocationId: string | null
  }>
  fetchOrdersSince(
    connection: PosConnection,
    since: Date,
  ): Promise<PosOrderLine[]>
  verifyWebhook(request: Request, body: string): Promise<boolean>
  parseWebhookPayload(payload: unknown): PosOrderLine[]
  /** Revoke the token with the provider on disconnect. Best-effort. */
  revokeToken?(accessToken: string): Promise<void>
}

export interface ProviderCredentialField {
  key: string
  label: string
  secret: boolean
}

/** Credential fields per api-key provider. Empty until Tevalis lands. */
export const PROVIDER_CREDENTIAL_FIELDS: Partial<Record<PosProvider, ProviderCredentialField[]>> = {}
