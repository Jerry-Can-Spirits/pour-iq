// Shared types for accounting integrations (Xero + QuickBooks Online).
// Mirrors the POS adapter pattern but push-only: no webhooks, no sync loop.

export type AccountingProvider = 'xero' | 'quickbooks'

const KNOWN_PROVIDERS: readonly AccountingProvider[] = ['xero', 'quickbooks']

export function isKnownAccountingProvider(p: string): p is AccountingProvider {
  return (KNOWN_PROVIDERS as readonly string[]).includes(p)
}

export interface AccountingConnection {
  id: string
  trade_account_id: string
  provider: AccountingProvider
  external_account_id: string
  external_account_name: string | null
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  default_account_code: string | null
  default_tax_code: string | null
  last_push_at: string | null
  last_push_error: string | null
  enabled: number
  created_at: string
  updated_at: string
}

export interface AccountingTokenSet {
  accessToken: string
  refreshToken: string | null
  expiresAt: string | null
}

export interface AccountingExchangeResult extends AccountingTokenSet {
  /** Xero tenantId / QBO realmId. '' when a Xero login holds several orgs
   *  and the venue must pick one in the finish-setup panel. */
  externalAccountId: string
  externalAccountName: string | null
  /** Xero only: all orgs on the login when there is more than one. */
  tenantCandidates: Array<{ id: string; name: string }> | null
}

export interface AccountingAccountOption { code: string; name: string }
export interface AccountingTaxOption { code: string; name: string }

export interface NeutralBillLine {
  description: string
  quantity: number
  unitAmountP: number
  lineTotalP: number | null
}

export interface NeutralBill {
  supplierName: string
  reference: string | null
  dateISO: string // YYYY-MM-DD
  amountsIncludeTax: boolean
  lines: NeutralBillLine[]
}

// Push-only adapter. No webhook methods by design.
export interface AccountingAdapter {
  provider: AccountingProvider
  /** realmId is the QBO callback query param; Xero ignores it. */
  exchangeCodeForToken(code: string, redirectUri: string, realmId: string | null): Promise<AccountingExchangeResult>
  refreshAccessToken(refreshToken: string): Promise<AccountingTokenSet>
  /** Xero org list for the finish-setup picker; QBO returns []. */
  listTenants(accessToken: string): Promise<Array<{ id: string; name: string }>>
  listExpenseAccounts(connection: AccountingConnection): Promise<AccountingAccountOption[]>
  listTaxOptions(connection: AccountingConnection): Promise<AccountingTaxOption[]>
  pushBill(connection: AccountingConnection, bill: NeutralBill): Promise<{ externalBillId: string }>
  /** Best-effort on disconnect. */
  revokeToken(connection: AccountingConnection): Promise<void>
}
