'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PourIqWordmark } from '@/components/pouriq/PourIqWordmark'
import { PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'
import { INPUT, LABEL } from '@/lib/pouriq/ui'

export default function TradeLoginPage() {
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({ error: 'Login failed' })) as { error?: string }
        setError(data.error ?? 'Login failed')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        <div className="mb-8">
          <PourIqWordmark />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-3">Sign in</h1>
        <p className="text-slate-500 text-sm mb-10">Enter your trade account PIN to continue.</p>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 border border-slate-200 space-y-5">
          <div>
            <label htmlFor="pin" className={LABEL}>Trade PIN</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className={INPUT}
            />
          </div>
          {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting || pin.length === 0}
            aria-disabled={submitting || pin.length === 0}
            className={`${PRIMARY_BUTTON} w-full justify-center`}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Don&rsquo;t have a trade account?{' '}
          <a href="https://pour-iq.co.uk/contact" className="text-emerald-700 hover:text-emerald-800 underline">Book a demo</a>
        </p>
      </div>
    </main>
  )
}
