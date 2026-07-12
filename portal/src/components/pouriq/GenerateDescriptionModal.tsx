'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/lib/pouriq/button-styles'

interface Props {
  cocktailId: string
  cocktailName: string
  existingDescription: string | null
}

export function GenerateDescriptionModal({ cocktailId, cocktailName, existingDescription }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(existingDescription ?? '')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settingsUrl, setSettingsUrl] = useState<string | null>(null)
  const [saving, startSave] = useTransition()

  async function generate() {
    setGenerating(true)
    setError(null)
    setSettingsUrl(null)
    try {
      const res = await fetch(`/api/pouriq/cocktails/${encodeURIComponent(cocktailId)}/description/generate`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: 'Generation failed' }))) as { error?: string; settings_url?: string }
        setError(err.error ?? 'Generation failed')
        if (err.settings_url) setSettingsUrl(err.settings_url)
        return
      }
      const data = (await res.json()) as { description: string }
      setText(data.description)
    } finally {
      setGenerating(false)
    }
  }

  function save() {
    setError(null)
    startSave(async () => {
      const res = await fetch(`/api/pouriq/cocktails/${encodeURIComponent(cocktailId)}/description/generate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text.trim() || null }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: 'Save failed' }))) as { error?: string }
        setError(err.error ?? 'Save failed')
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  const buttonLabel = existingDescription ? 'Regenerate description' : 'Generate description'

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setText(existingDescription ?? '')
          setError(null)
          setSettingsUrl(null)
          setOpen(true)
        }}
        className="text-xs text-emerald-700 hover:text-emerald-600 underline"
      >
        {buttonLabel}
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="mx-auto w-full max-w-xl rounded-xl bg-white border border-slate-200 p-6 max-h-[90vh] overflow-y-auto">
            <DialogTitle className="text-lg font-bold text-slate-900 mb-1">Description for {cocktailName}</DialogTitle>
            <p className="text-xs text-slate-500 mb-4">Edit before saving. Regenerate as many times as you like.</p>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Click Generate to start, or write your own description."
              className="w-full min-h-[160px] px-3 py-2 bg-white border border-slate-300 rounded-sm text-slate-900 focus:border-emerald-500 focus:outline-hidden"
              aria-label="Description text"
            />

            {error && (
              <p role="alert" className="text-sm text-rose-600 mt-3">
                {error}
                {settingsUrl && (
                  <>
                    {' '}
                    <a href={settingsUrl} className="underline text-emerald-700">Set Voice Profile</a>
                  </>
                )}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 mt-5">
              <button type="button" onClick={() => setOpen(false)} className={SECONDARY_BUTTON}>Cancel</button>
              <button
                type="button"
                onClick={generate}
                disabled={generating || saving}
                className={SECONDARY_BUTTON}
              >
                {generating ? 'Generating…' : existingDescription || text.trim() ? 'Regenerate' : 'Generate'}
              </button>
              <button type="button" onClick={save} disabled={saving || generating} className={PRIMARY_BUTTON}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}
