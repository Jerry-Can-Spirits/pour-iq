'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface AccountingCardConnection {
  external_account_name: string | null
  default_account_code: string | null
  needs_setup: boolean
  needs_reconnect: boolean
  last_push_at: string | null
  last_push_error: string | null
}

interface Props {
  provider: 'xero' | 'quickbooks'
  title: string
  description: string
  connection: AccountingCardConnection | null
  available: boolean
  unavailableReason?: string
}

interface Options {
  needsTenant: boolean
  tenants: Array<{ id: string; name: string }>
  accounts: Array<{ code: string; name: string }>
  taxOptions: Array<{ code: string; name: string }>
}

export function AccountingCard({ provider, title, description, connection, available, unavailableReason }: Props) {
  const router = useRouter()
  const [options, setOptions] = useState<Options | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState('')
  const [accountCode, setAccountCode] = useState('')
  const [taxCode, setTaxCode] = useState('')
  const [saving, setSaving] = useState(false)

  const needsSetup = connection?.needs_setup === true

  const loadOptions = useCallback(async (tenant?: string) => {
    setOptionsError(null)
    const qs = tenant ? `?tenant=${encodeURIComponent(tenant)}` : ''
    const res = await fetch(`/api/pouriq/integrations/accounting/${provider}/options${qs}`)
    if (!res.ok) {
      setOptionsError('Could not load choices from the provider. Try reconnecting.')
      return
    }
    const data = await res.json() as Options
    setOptions(data)
    const standard = data.taxOptions.find((t) => /20%/.test(t.name))
    if (standard) setTaxCode((prev) => prev || standard.code)
  }, [provider])

  useEffect(() => {
    if (needsSetup) void loadOptions()
  }, [needsSetup, loadOptions])

  async function saveSetup() {
    setSaving(true)
    try {
      const tenantName = options?.tenants.find((t) => t.id === tenantId)?.name
      const res = await fetch(`/api/pouriq/integrations/accounting/${provider}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(tenantId ? { tenant_id: tenantId, tenant_name: tenantName } : {}),
          default_account_code: accountCode,
          default_tax_code: taxCode,
        }),
      })
      if (res.ok) router.refresh()
      else setOptionsError('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function disconnect() {
    if (!window.confirm(`Disconnect ${title}? Pushed bills stay in ${title}; new invoices stop syncing.`)) return
    const res = await fetch(`/api/pouriq/integrations/accounting/${provider}/disconnect`, { method: 'POST' })
    if (res.ok) router.refresh()
    else setOptionsError('Could not disconnect. Please try again.')
  }

  return (
    <div className={`rounded-xl border p-5 ${available ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        </div>
        {!available ? (
          <span className={`text-xs text-slate-400 ${unavailableReason ? 'text-right max-w-[12rem]' : 'whitespace-nowrap'}`}>
            {unavailableReason ?? 'Coming soon'}
          </span>
        ) : !connection ? (
          <a
            href={`/api/pouriq/integrations/accounting/${provider}/oauth/start`}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 whitespace-nowrap"
          >
            Connect {title}
          </a>
        ) : (
          <button type="button" onClick={disconnect} className="text-sm text-slate-500 hover:text-rose-600 whitespace-nowrap">
            Disconnect
          </button>
        )}
      </div>

      {optionsError && <p role="alert" className="mt-4 text-sm text-rose-600">{optionsError}</p>}

      {available && connection && connection.needs_reconnect && (
        <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
          <p role="alert" className="text-sm text-rose-600">
            The connection has stopped working and pushing is paused. Reconnect to resume.
          </p>
          <a
            href={`/api/pouriq/integrations/accounting/${provider}/oauth/start`}
            className="inline-block px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 whitespace-nowrap"
          >
            Reconnect {title}
          </a>
        </div>
      )}

      {available && connection && !connection.needs_reconnect && !needsSetup && (
        <div className="mt-4 text-sm text-slate-600 space-y-1">
          <p>
            Connected to <strong className="text-slate-900">{connection.external_account_name ?? title}</strong>,
            coding bills to account {connection.default_account_code}.
          </p>
          <p className="text-slate-500">
            {connection.last_push_at ? `Last push ${connection.last_push_at}.` : 'No invoices pushed yet. The next committed invoice goes across automatically.'}
          </p>
          {connection.last_push_error && (
            <p role="alert" className="text-rose-600">Last push failed: {connection.last_push_error}</p>
          )}
        </div>
      )}

      {available && connection && !connection.needs_reconnect && needsSetup && (
        <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
          <p className="text-sm font-medium text-slate-900">Finish setup</p>
          <p className="text-sm text-slate-500">
            Choose where pushed bills should be coded. Invoices committed in the meantime are queued and pushed once this is saved.
          </p>
          {options?.needsTenant && (
            <label className="block text-sm">
              <span className="text-slate-700">Organisation</span>
              <select
                value={tenantId}
                onChange={(e) => { setTenantId(e.target.value); void loadOptions(e.target.value) }}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Choose an organisation</option>
                {options.tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          )}
          {options && !options.needsTenant && options.accounts.length > 0 && (
            <>
              <label className="block text-sm">
                <span className="text-slate-700">Bills are coded to</span>
                <select
                  value={accountCode}
                  onChange={(e) => setAccountCode(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Choose an expense account</option>
                  {options.accounts.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-700">VAT treatment</span>
                <select
                  value={taxCode}
                  onChange={(e) => setTaxCode(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Choose a VAT rate</option>
                  {options.taxOptions.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
                </select>
              </label>
              <button
                type="button"
                onClick={saveSetup}
                disabled={saving || !accountCode || !taxCode}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? 'Saving' : 'Save and start pushing'}
              </button>
            </>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">
        Need help? Contact <a href="mailto:trade@jerrycanspirits.co.uk" className="underline">trade@jerrycanspirits.co.uk</a>
      </p>
    </div>
  )
}
