import type {
  AccountingAdapter, AccountingConnection, AccountingExchangeResult,
  AccountingTokenSet, NeutralBill,
} from '../types'
import { poundsFromPence } from '../bill-builder'

const TOKEN_URL = 'https://identity.xero.com/connect/token'
const REVOKE_URL = 'https://identity.xero.com/connect/revocation'
const CONNECTIONS_URL = 'https://api.xero.com/connections'
const API_BASE = 'https://api.xero.com/api.xro/2.0'

export const XERO_AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize'
export const XERO_SCOPES = 'openid profile email accounting.transactions accounting.settings.read offline_access'

export interface XeroEnv {
  XERO_CLIENT_ID: string
  XERO_CLIENT_SECRET: string
}

const EXPENSE_ACCOUNT_TYPES = ['EXPENSE', 'DIRECTCOSTS', 'OVERHEADS']

function toExpiryIso(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString()
}

export function createXeroAdapter(env: XeroEnv): AccountingAdapter {
  const basicAuth = `Basic ${btoa(`${env.XERO_CLIENT_ID}:${env.XERO_CLIENT_SECRET}`)}`

  async function tokenRequest(body: URLSearchParams): Promise<AccountingTokenSet> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { Authorization: basicAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) throw new Error(`Xero ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: toExpiryIso(data.expires_in),
    }
  }

  async function apiRequest<T>(connection: AccountingConnection, path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        'Xero-Tenant-Id': connection.external_account_id,
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
    if (!res.ok) throw new Error(`Xero ${res.status}: ${(await res.text()).slice(0, 300)}`)
    return await res.json() as T
  }

  async function listTenants(accessToken: string): Promise<Array<{ id: string; name: string }>> {
    const res = await fetch(CONNECTIONS_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Xero ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const tenants = await res.json() as Array<{ tenantId: string; tenantName?: string }>
    return tenants.map((t) => ({ id: t.tenantId, name: t.tenantName ?? 'Unnamed organisation' }))
  }

  return {
    provider: 'xero',

    async exchangeCodeForToken(code, redirectUri): Promise<AccountingExchangeResult> {
      const tokens = await tokenRequest(new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }))
      const tenants = await listTenants(tokens.accessToken)
      if (tenants.length === 0) throw new Error('Xero returned no connected organisations')
      if (tenants.length === 1) {
        return {
          ...tokens,
          externalAccountId: tenants[0].id,
          externalAccountName: tenants[0].name,
          tenantCandidates: null,
        }
      }
      // Several orgs on this login: the finish-setup panel asks which.
      return { ...tokens, externalAccountId: '', externalAccountName: null, tenantCandidates: tenants }
    },

    async refreshAccessToken(refreshToken) {
      return await tokenRequest(new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }))
    },

    listTenants,

    async listExpenseAccounts(connection) {
      const data = await apiRequest<{ Accounts?: Array<{ Code?: string; Name?: string; Type?: string; Status?: string }> }>(
        connection, '/Accounts',
      )
      return (data.Accounts ?? [])
        .filter((a) => a.Status === 'ACTIVE' && a.Code && a.Name && EXPENSE_ACCOUNT_TYPES.includes(a.Type ?? ''))
        .map((a) => ({ code: a.Code as string, name: a.Name as string }))
    },

    async listTaxOptions(connection) {
      const data = await apiRequest<{ TaxRates?: Array<{ TaxType?: string; Name?: string; Status?: string; CanApplyToExpenses?: boolean }> }>(
        connection, '/TaxRates',
      )
      return (data.TaxRates ?? [])
        .filter((r) => r.Status === 'ACTIVE' && r.CanApplyToExpenses === true && r.TaxType && r.Name)
        .map((r) => ({ code: r.TaxType as string, name: r.Name as string }))
    },

    async pushBill(connection, bill: NeutralBill) {
      const payload = {
        Invoices: [{
          Type: 'ACCPAY',
          Status: 'DRAFT',
          Contact: { Name: bill.supplierName },
          Date: bill.dateISO,
          ...(bill.reference ? { InvoiceNumber: bill.reference } : {}),
          LineAmountTypes: bill.amountsIncludeTax ? 'Inclusive' : 'Exclusive',
          LineItems: bill.lines.map((l) => ({
            Description: l.description,
            Quantity: l.quantity,
            UnitAmount: poundsFromPence(l.unitAmountP),
            ...(l.lineTotalP !== null ? { LineAmount: poundsFromPence(l.lineTotalP) } : {}),
            AccountCode: connection.default_account_code,
            TaxType: connection.default_tax_code,
          })),
        }],
      }
      const data = await apiRequest<{ Invoices?: Array<{ InvoiceID?: string }> }>(
        connection, '/Invoices', { method: 'POST', body: JSON.stringify(payload) },
      )
      const externalBillId = data.Invoices?.[0]?.InvoiceID
      if (!externalBillId) throw new Error('Xero response contained no InvoiceID')
      return { externalBillId }
    },

    async revokeToken(connection) {
      if (!connection.refresh_token) return
      await fetch(REVOKE_URL, {
        method: 'POST',
        headers: { Authorization: basicAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: connection.refresh_token }),
      })
    },
  }
}
