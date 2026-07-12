'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/lib/pouriq/button-styles'

interface Props {
  menuId: string
  missingCount: number   // number of drinks currently without a description
}

interface BulkResult {
  cocktail_id: string
  name: string
  description?: string
  error?: string
}

export function BulkGenerateDescriptionsButton({ menuId, missingCount }: Props) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [resultsOpen, setResultsOpen] = useState(false)
  const [results, setResults] = useState<BulkResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [settingsUrl, setSettingsUrl] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run() {
    setConfirmOpen(false)
    setError(null)
    setSettingsUrl(null)
    startTransition(async () => {
      const res = await fetch(`/api/pouriq/menus/${encodeURIComponent(menuId)}/descriptions/generate-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: 'Bulk run failed' }))) as { error?: string; settings_url?: string }
        setError(err.error ?? 'Bulk run failed')
        if (err.settings_url) setSettingsUrl(err.settings_url)
        return
      }
      const data = (await res.json()) as { results: BulkResult[] }
      setResults(data.results)
      setResultsOpen(true)
      router.refresh()
    })
  }

  const disabled = pending || missingCount === 0

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={disabled}
        className={SECONDARY_BUTTON}
        title={missingCount === 0 ? 'All drinks already have a description.' : undefined}
      >
        {pending ? 'Generating…' : `Generate for ${missingCount} drink${missingCount === 1 ? '' : 's'}`}
      </button>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="mx-auto w-full max-w-md rounded-xl bg-white border border-slate-200 p-6">
            <DialogTitle className="text-lg font-bold text-slate-900 mb-2">Generate descriptions?</DialogTitle>
            <p className="text-sm text-slate-600 mb-5">
              This will generate descriptions for {missingCount} drink{missingCount === 1 ? '' : 's'} using your Voice Profile. You can edit each one afterwards.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className={SECONDARY_BUTTON}>Cancel</button>
              <button type="button" onClick={run} className={PRIMARY_BUTTON}>Generate</button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Results dialog */}
      <Dialog open={resultsOpen} onClose={() => setResultsOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="mx-auto w-full max-w-xl rounded-xl bg-white border border-slate-200 p-6 max-h-[90vh] overflow-y-auto">
            <DialogTitle className="text-lg font-bold text-slate-900 mb-3">Bulk generation complete</DialogTitle>
            <ul className="space-y-3">
              {results.map((r) => (
                <li key={r.cocktail_id} className="border-b border-slate-100 pb-3 last:border-0">
                  <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                  {r.description ? (
                    <p className="text-sm text-slate-600 mt-1">{r.description}</p>
                  ) : (
                    <p role="alert" className="text-sm text-rose-600 mt-1">{r.error ?? 'Failed'}</p>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex justify-end mt-5">
              <button type="button" onClick={() => setResultsOpen(false)} className={PRIMARY_BUTTON}>Done</button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {error && (
        <p role="alert" className="text-sm text-rose-600 mt-2">
          {error}
          {settingsUrl && (
            <>
              {' '}
              <a href={settingsUrl} className="underline text-emerald-700">Set Voice Profile</a>
            </>
          )}
        </p>
      )}
    </>
  )
}
