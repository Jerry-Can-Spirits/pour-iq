'use client'

import { useRef, useState } from 'react'
import type { Recommendation } from '@/lib/pouriq/types'
import { PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'

const severityStyles: Record<Recommendation['severity'], string> = {
  info: 'border-slate-200 bg-white',
  warn: 'border-amber-200 bg-amber-50',
  action: 'border-rose-200 bg-rose-50',
}

export function RecommendationStream({ menuId }: { menuId: string }) {
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  async function start() {
    if (startedRef.current) return
    startedRef.current = true
    setStreaming(true)
    setRecs([])
    setError(null)

    const res = await fetch(`/api/pouriq/recommend?menuId=${encodeURIComponent(menuId)}`, {
      method: 'POST',
    })
    if (!res.ok || !res.body) {
      setError('Could not generate recommendations. Try again.')
      setStreaming(false)
      startedRef.current = false
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const ev = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        const lines = ev.split('\n')
        const eventLine = lines.find((l) => l.startsWith('event: '))
        const dataLine = lines.find((l) => l.startsWith('data: '))
        if (!dataLine) continue
        if (eventLine === 'event: error') {
          try {
            const errObj = JSON.parse(dataLine.slice(6)) as { error?: string }
            setError(errObj.error ?? 'AI recommendation failed.')
          } catch {
            setError('AI recommendation failed.')
          }
          continue
        }
        const payload = dataLine.slice(6)
        if (payload === '[DONE]') continue
        try {
          const obj = JSON.parse(payload) as Recommendation
          setRecs((arr) => [...arr, obj])
        } catch { /* ignore malformed */ }
      }
    }
    setStreaming(false)
  }

  return (
    <div>
      {recs.length === 0 && !streaming && !error && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center no-print">
          <p className="text-slate-700 mb-4">Generate AI recommendations for this menu.</p>
          <button onClick={start} className={PRIMARY_BUTTON}>
            Analyse menu
          </button>
        </div>
      )}

      {streaming && recs.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-slate-700">Reading your menu…</p>
        </div>
      )}

      {recs.length > 0 && (
        <div className="space-y-4">
          {recs.map((r, i) => (
            <article key={i} className={`border rounded-xl p-5 ${severityStyles[r.severity]}`}>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-xs uppercase tracking-widest text-slate-500">{r.category}</span>
                <h3 className="text-lg font-bold text-slate-900">{r.title}</h3>
              </div>
              <p className="text-slate-700 text-sm leading-relaxed">{r.body}</p>
              {r.suggested_change && (
                <div className="mt-3 text-sm text-slate-700">
                  <strong className="text-slate-900">Suggested: </strong>
                  {r.suggested_change.action.replace('_', ' ')}
                  {r.suggested_change.from && r.suggested_change.to && ` — ${r.suggested_change.from} → ${r.suggested_change.to}`}
                  <p className="text-xs text-slate-500 mt-1">{r.suggested_change.impact_summary}</p>
                </div>
              )}
              {r.field_manual_reference && (
                <a href={r.field_manual_reference.url} className="inline-block mt-3 text-xs text-emerald-700 hover:text-emerald-800 underline">
                  See in the Field Manual
                </a>
              )}
            </article>
          ))}
          {streaming && <p className="text-slate-500 text-sm no-print">Generating more…</p>}
          {!streaming && (
            <button onClick={() => { startedRef.current = false; start() }} className="text-sm text-emerald-700 hover:text-emerald-800 underline no-print">
              Re-run analysis
            </button>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-sm text-rose-600">
          {error}
        </div>
      )}
    </div>
  )
}
