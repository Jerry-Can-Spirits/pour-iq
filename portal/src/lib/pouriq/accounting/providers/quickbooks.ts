import type {
  AccountingAdapter, AccountingConnection, AccountingExchangeResult,
  AccountingTokenSet, NeutralBill,
} from '../types'
import { poundsFromPence } from '../bill-builder'

const DISCOVERY_PRODUCTION = 'https://developer.api.intuit.com/.well-known/openid_configuration'
const DISCOVERY_SANDBOX = 'https://developer.api.intuit.com/.well-known/openid_sandbox_configuration'
const REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'
const MINOR_VERSION = '75'
const DOC_NUMBER_MAX = 21

export interface QuickBooksEnv {
  QUICKBOOKS_CLIENT_ID: string
  QUICKBOOKS_CLIENT_SECRET: string
  QUICKBOOKS_ENV?: string
}

interface Discovery {
  authorization_endpoint: string
  token_endpoint: string
}

// Endpoints come from Intuit's discovery document, never hardcoded
// (a written Intuit production-questionnaire commitment). Cached per isolate.
let discoveryCache: Discovery | null = null

export function resetQuickBooksDiscoveryCache(): void {
  discoveryCache = null
}

export async function getQuickBooksDiscovery(env: Pick<QuickBooksEnv, 'QUICKBOOKS_ENV'>): Promise<Discovery> {
  if (discoveryCache) return discoveryCache
  const url = env.QUICKBOOKS_ENV === 'production' ? DISCOVERY_PRODUCTION : DISCOVERY_SANDBOX
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const tid = res.headers.get('intuit_tid') ?? 'none'
    throw new Error(`QuickBooks discovery ${res.status} [intuit_tid ${tid}]`)
  }
  const doc = await res.json() as Discovery
  discoveryCache = doc
  return doc
}

function apiBase(env: Pick<QuickBooksEnv, 'QUICKBOOKS_ENV'>): string {
  return env.QUICKBOOKS_ENV === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

function toExpiryIso(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString()
}

export function createQuickBooksAdapter(env: QuickBooksEnv): AccountingAdapter {
  const basicAuth = `Basic ${btoa(`${env.QUICKBOOKS_CLIENT_ID}:${env.QUICKBOOKS_CLIENT_SECRET}`)}`
  const base = apiBase(env)

  async function qboFetch<T>(url: string, init?: RequestInit, accessToken?: string): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init?.body && !(init.body instanceof URLSearchParams) ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
    if (!res.ok) {
      const tid = res.headers.get('intuit_tid') ?? 'none'
      throw new Error(`QuickBooks ${res.status} [intuit_tid ${tid}]: ${(await res.text()).slice(0, 300)}`)
    }
    return await res.json() as T
  }

  async function tokenRequest(body: URLSearchParams): Promise<AccountingTokenSet> {
    const discovery = await getQuickBooksDiscovery(env)
    const data = await qboFetch<{ access_token: string; refresh_token?: string; expires_in: number }>(
      discovery.token_endpoint,
      {
        method: 'POST',
        headers: { Authorization: basicAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
    )
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: toExpiryIso(data.expires_in),
    }
  }

  async function query<T>(connection: AccountingConnection, q: string): Promise<T> {
    const url = `${base}/v3/company/${encodeURIComponent(connection.external_account_id)}/query?query=${encodeURIComponent(q)}&minorversion=${MINOR_VERSION}`
    return await qboFetch<T>(url, undefined, connection.access_token)
  }

  async function resolveVendorId(connection: AccountingConnection, name: string): Promise<string> {
    const escaped = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    const found = await query<{ QueryResponse?: { Vendor?: Array<{ Id: string }> } }>(
      connection, `select Id from Vendor where DisplayName = '${escaped}'`,
    )
    const existing = found.QueryResponse?.Vendor?.[0]?.Id
    if (existing) return existing
    const created = await qboFetch<{ Vendor: { Id: string } }>(
      `${base}/v3/company/${encodeURIComponent(connection.external_account_id)}/vendor?minorversion=${MINOR_VERSION}`,
      { method: 'POST', body: JSON.stringify({ DisplayName: name }) },
      connection.access_token,
    )
    return created.Vendor.Id
  }

  return {
    provider: 'quickbooks',

    async exchangeCodeForToken(code, redirectUri, realmId): Promise<AccountingExchangeResult> {
      if (!realmId || !/^\d+$/.test(realmId)) throw new Error('QuickBooks callback did not include a valid realmId')
      const tokens = await tokenRequest(new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }))
      // Company name is display sugar; never fail the connection over it.
      let companyName: string | null = null
      try {
        const info = await qboFetch<{ CompanyInfo?: { CompanyName?: string } }>(
          `${base}/v3/company/${encodeURIComponent(realmId)}/companyinfo/${encodeURIComponent(realmId)}?minorversion=${MINOR_VERSION}`,
          undefined, tokens.accessToken,
        )
        companyName = info.CompanyInfo?.CompanyName ?? null
      } catch { /* best-effort */ }
      return { ...tokens, externalAccountId: realmId, externalAccountName: companyName, tenantCandidates: null }
    },

    async refreshAccessToken(refreshToken) {
      return await tokenRequest(new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }))
    },

    async listTenants() {
      return []
    },

    async listExpenseAccounts(connection) {
      const data = await query<{ QueryResponse?: { Account?: Array<{ Id: string; Name: string }> } }>(
        connection,
        `select Id, Name from Account where AccountType in ('Expense', 'Cost of Goods Sold', 'Other Expense') and Active = true maxresults 1000`,
      )
      return (data.QueryResponse?.Account ?? []).map((a) => ({ code: a.Id, name: a.Name }))
    },

    async listTaxOptions(connection) {
      const data = await query<{ QueryResponse?: { TaxCode?: Array<{ Id: string; Name: string }> } }>(
        connection, `select Id, Name from TaxCode where Active = true maxresults 1000`,
      )
      return (data.QueryResponse?.TaxCode ?? []).map((t) => ({ code: t.Id, name: t.Name }))
    },

    async pushBill(connection, bill: NeutralBill) {
      const vendorId = await resolveVendorId(connection, bill.supplierName)
      const payload = {
        VendorRef: { value: vendorId },
        TxnDate: bill.dateISO,
        ...(bill.reference ? { DocNumber: bill.reference.slice(0, DOC_NUMBER_MAX) } : {}),
        GlobalTaxCalculation: bill.amountsIncludeTax ? 'TaxInclusive' : 'TaxExcluded',
        Line: bill.lines.map((l) => ({
          Amount: poundsFromPence(l.lineTotalP ?? Math.round(l.unitAmountP * l.quantity)),
          DetailType: 'AccountBasedExpenseLineDetail',
          Description: l.description,
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: connection.default_account_code },
            TaxCodeRef: { value: connection.default_tax_code },
          },
        })),
      }
      const data = await qboFetch<{ Bill?: { Id?: string } }>(
        `${base}/v3/company/${encodeURIComponent(connection.external_account_id)}/bill?minorversion=${MINOR_VERSION}`,
        { method: 'POST', body: JSON.stringify(payload) },
        connection.access_token,
      )
      const externalBillId = data.Bill?.Id
      if (!externalBillId) throw new Error('QuickBooks response contained no Bill Id')
      return { externalBillId }
    },

    async revokeToken(connection) {
      const token = connection.refresh_token ?? connection.access_token
      const res = await fetch(REVOKE_URL, {
        method: 'POST',
        headers: { Authorization: basicAuth, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        const tid = res.headers.get('intuit_tid') ?? 'none'
        throw new Error(`QuickBooks revoke ${res.status} [intuit_tid ${tid}]`)
      }
    },
  }
}
