'use client'

import { useState } from 'react'

// Persistent demo chrome. Copy is supplied and byte-exact — do not edit.
const BANNER_TEXT = "You're exploring The Signal Box, a demo venue. Nothing you do here is saved."
const CTA_TEXT = 'Book a real demo'
const RESET_TEXT = 'Reset the demo'

// The marketing contact page (the real "book a demo" destination).
const CONTACT_URL = 'https://pour-iq.co.uk/contact'

export function DemoBanner() {
  const [resetting, setResetting] = useState(false)

  async function reset() {
    setResetting(true)
    try {
      await fetch('/api/demo/reset', { method: 'POST' })
      window.location.reload()
    } catch {
      setResetting(false)
    }
  }

  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <p className="min-w-0">{BANNER_TEXT}</p>
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={reset}
          disabled={resetting}
          className="rounded-md px-3 py-1 font-medium text-amber-900 underline decoration-amber-400 underline-offset-4 hover:text-amber-950 disabled:opacity-60"
        >
          {RESET_TEXT}
        </button>
        <a
          href={CONTACT_URL}
          className="rounded-md bg-amber-900 px-3 py-1 font-medium text-amber-50 hover:bg-amber-950"
        >
          {CTA_TEXT}
        </a>
      </div>
    </div>
  )
}
