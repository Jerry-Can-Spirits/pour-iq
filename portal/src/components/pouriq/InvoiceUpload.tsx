'use client'

import { useRef, useState } from 'react'
import { PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'

interface Props {
  onUploaded: (ticket: string, filename: string) => void
  disabled?: boolean
}

export function InvoiceUpload({ onUploaded, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  async function uploadFile(file: File) {
    setError(null)
    if (file.size === 0) { setError('Empty file'); return }
    if (file.size > 5 * 1024 * 1024) { setError('File exceeds 5MB limit'); return }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are accepted'); return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/pouriq/invoices/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' })) as { error?: string }
        throw new Error(data.error ?? 'Upload failed')
      }
      const data = (await res.json()) as { ticket: string; filename: string }
      onUploaded(data.ticket, data.filename)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  function handleChoose() {
    if (!disabled && !uploading) inputRef.current?.click()
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    void uploadFile(files[0])
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled && !uploading) setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (disabled || uploading) return
        handleFiles(e.dataTransfer.files)
      }}
      className={`bg-white rounded-xl p-10 border-2 border-dashed transition-colors ${
        dragOver ? 'border-emerald-600 bg-emerald-50' : 'border-slate-300'
      }`}
    >
      <div className="text-center">
        <p className="text-lg text-slate-900 mb-2">Drop a supplier invoice PDF here</p>
        <p className="text-sm text-slate-500 mb-6">Or choose a file. Maximum 5MB.</p>
        <button
          type="button"
          onClick={handleChoose}
          disabled={disabled || uploading}
          className={PRIMARY_BUTTON}
        >
          {uploading ? 'Uploading…' : 'Choose a PDF'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {error && <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p>}
      </div>
    </div>
  )
}
