'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PROVIDER_CREDENTIAL_FIELDS, type PosConnection, type PosProvider } from '@/lib/pouriq/pos/types'
import { PRIMARY_BUTTON, SECONDARY_BUTTON_SM, DESTRUCTIVE_BUTTON } from '@/lib/pouriq/button-styles'

interface Props {
  provider: PosProvider
  title: string
  description: string
  connection: PosConnection | null
  activeMenuName: string | null
  disabled?: boolean
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function IntegrationCard({ provider, title, description, connection, activeMenuName, disabled }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<Record<string, string>>({})

  const credentialFields = PROVIDER_CREDENTIAL_FIELDS[provider]

  function connect() {
    window.location.href = `/api/pouriq/integrations/${provider}/oauth/start`
  }

  function connectWithKey() {
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/pouriq/integrations/${provider}/connect-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: credentials }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        setError(err.error ?? 'Could not connect')
        return
      }
      router.refresh()
    })
  }

  function disconnect() {
    if (!confirm(`Disconnect ${title}? Volumes already imported are kept.`)) return
    startTransition(async () => {
      const res = await fetch(`/api/pouriq/integrations/${provider}/disconnect`, { method: 'POST' })
      if (!res.ok) setError('Could not disconnect')
      else router.refresh()
    })
  }

  function sync() {
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/pouriq/integrations/${provider}/sync`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        setError(err.error ?? 'Sync failed')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {connection ? (
          <span className="text-xs text-emerald-600">Connected</span>
        ) : disabled ? (
          <span className="text-xs text-slate-400">Coming soon</span>
        ) : (
          <span className="text-xs text-slate-500">Not connected</span>
        )}
      </div>
      <p className="text-sm text-slate-600 mb-4">{description}</p>

      {connection && (
        <p className="text-xs text-slate-500 mb-4">
          Last sync: {formatRelativeTime(connection.last_synced_at)}
          {connection.last_sync_error && (
            <span className="block text-rose-600 mt-1">Last error: {connection.last_sync_error}</span>
          )}
        </p>
      )}

      {connection && (
        <p className="text-xs mb-4">
          {activeMenuName ? (
            <span className="text-slate-500">
              Sales route to your active menu: <span className="text-slate-700">{activeMenuName}</span>
            </span>
          ) : (
            <span className="text-amber-600">
              Set an active menu so sales can flow — choose one on the Pour IQ dashboard. The next sync backfills anything received while paused.
            </span>
          )}
        </p>
      )}

      {error && <p role="alert" className="text-xs text-rose-600 mb-3">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {connection ? (
          <>
            <button type="button" onClick={sync} disabled={pending} className={SECONDARY_BUTTON_SM}>
              {pending ? 'Syncing…' : 'Sync now'}
            </button>
            <button type="button" onClick={disconnect} disabled={pending} className={DESTRUCTIVE_BUTTON}>
              Disconnect
            </button>
          </>
        ) : credentialFields ? (
          <form
            onSubmit={(e) => { e.preventDefault(); connectWithKey() }}
            className="w-full space-y-3"
          >
            {credentialFields.map((f) => (
              <div key={f.key}>
                <label htmlFor={`${provider}-${f.key}`} className="block text-xs font-medium text-slate-600 mb-1">
                  {f.label}
                </label>
                <input
                  id={`${provider}-${f.key}`}
                  type={f.secret ? 'password' : 'text'}
                  autoComplete="off"
                  value={credentials[f.key] ?? ''}
                  onChange={(e) => setCredentials((c) => ({ ...c, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden"
                />
              </div>
            ))}
            <button type="submit" disabled={disabled || pending} className={PRIMARY_BUTTON}>
              {pending ? 'Connecting…' : `Connect ${title}`}
            </button>
          </form>
        ) : (
          <button type="button" onClick={connect} disabled={disabled || pending} className={PRIMARY_BUTTON}>
            Connect {title}
          </button>
        )}
      </div>
    </div>
  )
}
