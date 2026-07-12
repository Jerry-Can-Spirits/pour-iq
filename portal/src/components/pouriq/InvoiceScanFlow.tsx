'use client'

import { useState } from 'react'
import { InvoiceUpload } from './InvoiceUpload'
import { InvoicePreview } from './InvoicePreview'
import type { PreviewPayload } from '@/app/api/pouriq/invoices/extract/route'
import type { IngredientLibraryRow } from '@/lib/pouriq/types'

type Phase =
  | { kind: 'upload' }
  | { kind: 'extracting'; filename: string }
  | { kind: 'preview'; payload: PreviewPayload }

interface Props {
  library: IngredientLibraryRow[]
}

export function InvoiceScanFlow({ library }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'upload' })
  const [error, setError] = useState<string | null>(null)

  async function handleUploaded(ticket: string, filename: string) {
    setError(null)
    setPhase({ kind: 'extracting', filename })
    try {
      const res = await fetch('/api/pouriq/invoices/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ticket }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Extraction failed' })) as { error?: string }
        throw new Error(data.error ?? 'Extraction failed')
      }
      const payload = (await res.json()) as PreviewPayload
      setPhase({ kind: 'preview', payload })
    } catch (e) {
      setError((e as Error).message)
      setPhase({ kind: 'upload' })
    }
  }

  if (phase.kind === 'upload') {
    return (
      <>
        <InvoiceUpload onUploaded={handleUploaded} />
        {error && <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p>}
      </>
    )
  }

  if (phase.kind === 'extracting') {
    return (
      <div role="status" className="bg-white rounded-xl p-10 border border-slate-200 text-center">
        <p className="text-lg text-slate-900 mb-2">Reading {phase.filename}…</p>
        <p className="text-sm text-slate-500">This usually takes a few seconds.</p>
      </div>
    )
  }

  return <InvoicePreview initial={phase.payload} library={library} />
}
