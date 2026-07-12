'use client'

import { useRef, useState } from 'react'
import type { PreviewPayload } from '@/app/api/pouriq/import/extract/route'
import { spreadsheetToText } from '@/lib/pouriq/spreadsheet-to-text'
import { PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'

type Source = 'text' | 'pdf' | 'spreadsheet'

const inputClass = 'w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-emerald-500 focus:outline-hidden'

interface SourceTile {
  id: Source
  title: string
  description: string
}

const SOURCES: SourceTile[] = [
  { id: 'text', title: 'Paste menu text', description: 'Copy from your existing menu or type it out.' },
  { id: 'pdf', title: 'Upload a PDF', description: 'Photo, scan, or print-ready PDF — we read it directly.' },
  { id: 'spreadsheet', title: 'Upload spreadsheet', description: 'Excel (.xlsx) or CSV. Best if your costs already live in a sheet.' },
]

interface Props {
  menuId: string
  initialSource?: Source | null
  onPreview: (payload: PreviewPayload) => void
}

export function ImportSourceTabs({ menuId, initialSource, onPreview }: Props) {
  const [source, setSource] = useState<Source | null>(initialSource ?? null)
  const [text, setText] = useState('')
  const [pdfTicket, setPdfTicket] = useState<{ ticket: string; filename: string } | null>(null)
  const [spreadsheetText, setSpreadsheetText] = useState<{ text: string; filename: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const sheetInputRef = useRef<HTMLInputElement>(null)

  async function handlePdf(file: File | null) {
    setError(null)
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('File exceeds 5MB limit'); return }
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Only PDF files are accepted'); return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/pouriq/import/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' })) as { error?: string }
        setError(data.error ?? 'Upload failed')
        return
      }
      const data = await res.json() as { ticket: string; filename: string }
      setPdfTicket(data)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSpreadsheet(file: File | null) {
    setError(null)
    if (!file) return
    setSubmitting(true)
    try {
      const text = await spreadsheetToText(file)
      setSpreadsheetText({ text, filename: file.name })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this file')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleExtract() {
    setError(null)
    setSubmitting(true)
    try {
      let body: { menuId: string; source: 'text'; text: string } | { menuId: string; source: 'pdf'; ticket: string }
      if (source === 'text') {
        body = { menuId, source: 'text', text }
      } else if (source === 'pdf') {
        if (!pdfTicket) { setError('Upload a PDF first'); setSubmitting(false); return }
        body = { menuId, source: 'pdf', ticket: pdfTicket.ticket }
      } else {
        if (!spreadsheetText) { setError('Upload a spreadsheet first'); setSubmitting(false); return }
        body = { menuId, source: 'text', text: spreadsheetText.text }
      }
      const res = await fetch('/api/pouriq/import/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Extraction failed' })) as { error?: string }
        setError(data.error ?? 'Extraction failed')
        return
      }
      const payload = await res.json() as PreviewPayload
      onPreview(payload)
    } finally {
      setSubmitting(false)
    }
  }

  function changeSource() {
    setSource(null)
    setError(null)
    setText('')
    setPdfTicket(null)
    setSpreadsheetText(null)
  }

  const canExtract =
    source === 'text' ? text.trim().length > 0 :
    source === 'pdf' ? pdfTicket !== null :
    source === 'spreadsheet' ? spreadsheetText !== null :
    false

  if (source === null) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Choose where your menu data is coming from.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSource(s.id)}
              className="text-left bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-400 rounded-xl p-4 transition-colors"
            >
              <h3 className="text-base font-bold text-slate-900 mb-1">{s.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{s.description}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-900">{SOURCES.find((s) => s.id === source)?.title}</span>
        </p>
        <button type="button" onClick={changeSource} className="text-xs text-slate-500 hover:text-slate-700 underline">
          Change source
        </button>
      </div>

      {source === 'text' && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          className={`${inputClass} resize-vertical font-mono text-xs`}
          placeholder="Paste your menu here. Drink names, ingredients, and prices if you have them."
        />
      )}

      {source === 'pdf' && (
        <div>
          <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" className="sr-only" onChange={(e) => handlePdf(e.target.files?.[0] ?? null)} />
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => pdfInputRef.current?.click()} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:border-emerald-500 transition-colors text-sm">
              {pdfTicket ? 'Replace PDF' : 'Choose PDF'}
            </button>
            {pdfTicket && <span className="text-sm text-slate-700">{pdfTicket.filename}</span>}
          </div>
          <p className="mt-2 text-xs text-slate-500">Max 5MB. PDF only.</p>
        </div>
      )}

      {source === 'spreadsheet' && (
        <div>
          <input ref={sheetInputRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => handleSpreadsheet(e.target.files?.[0] ?? null)} />
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => sheetInputRef.current?.click()} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:border-emerald-500 transition-colors text-sm">
              {spreadsheetText ? 'Replace file' : 'Choose spreadsheet'}
            </button>
            {spreadsheetText && <span className="text-sm text-slate-700">{spreadsheetText.filename}</span>}
          </div>
          <p className="mt-2 text-xs text-slate-500">Max 5MB. .csv or .xlsx. Headers like Name, Price, Ingredients help us read it.</p>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

      <div className="flex justify-end">
        <button type="button" onClick={handleExtract} disabled={!canExtract || submitting}
          className={PRIMARY_BUTTON}>
          {submitting ? 'Reading menu…' : 'Extract drinks →'}
        </button>
      </div>
    </div>
  )
}
