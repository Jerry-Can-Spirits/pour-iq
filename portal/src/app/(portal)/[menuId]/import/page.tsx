'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ImportSourceTabs } from '@/components/pouriq/ImportSourceTabs'
import { ImportPreview } from '@/components/pouriq/ImportPreview'
import type { PreviewPayload } from '@/app/api/pouriq/import/extract/route'
import type { IngredientLibraryRow, ServeUnitRow } from '@/lib/pouriq/types'

interface Props {
  params: Promise<{ menuId: string }>
}

type Source = 'text' | 'pdf' | 'spreadsheet'

function parseSource(raw: string | null): Source | null {
  if (raw === 'text' || raw === 'pdf' || raw === 'spreadsheet') return raw
  return null
}

export default function ImportPage({ params }: Props) {
  const searchParams = useSearchParams()
  const initialSource = parseSource(searchParams.get('source'))
  const [menuId, setMenuId] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewPayload | null>(null)
  const [library, setLibrary] = useState<IngredientLibraryRow[] | null>(null)
  const [serveUnits, setServeUnits] = useState<Record<string, ServeUnitRow[]> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { params.then(({ menuId: id }) => setMenuId(id)) }, [params])

  // Fetch library and serve units once when entering preview step.
  useEffect(() => {
    if (!preview || !menuId) return
    let cancelled = false
    Promise.all([
      fetch(`/api/pouriq/library?menuId=${encodeURIComponent(menuId)}`)
        .then((r) => r.ok ? r.json() as Promise<{ entries: IngredientLibraryRow[] }> : Promise.reject(new Error('library fetch failed'))),
      fetch('/api/pouriq/serve-units')
        .then((r) => r.ok ? r.json() as Promise<{ serveUnits: Record<string, ServeUnitRow[]> }> : Promise.reject(new Error('serve units fetch failed'))),
    ])
      .then(([libData, suData]) => {
        if (!cancelled) {
          setLibrary(libData.entries)
          setServeUnits(suData.serveUnits)
        }
      })
      .catch(() => { if (!cancelled) setError('Could not load your library — please reload the page') })
    return () => { cancelled = true }
  }, [preview, menuId])

  if (!menuId) return null

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24">
        <Link href={`/${menuId}`} className="text-sm text-slate-500 hover:text-slate-700">← Back to menu</Link>
        <h1 className="text-3xl font-bold text-slate-900 mt-4 mb-2">Import drinks</h1>
        <p className="text-slate-500 text-sm mb-10">
          Paste menu text, upload a PDF, or upload an Excel/CSV. We&rsquo;ll extract the drinks and match ingredients to your library — you confirm before anything is saved.
        </p>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          {!preview ? (
            <ImportSourceTabs menuId={menuId} initialSource={initialSource} onPreview={setPreview} />
          ) : library && serveUnits ? (
            <ImportPreview menuId={menuId} drinks={preview.drinks} libraryEntries={library} serveUnits={serveUnits} truncated={preview.truncated} />
          ) : (
            <p className="text-slate-600 text-sm">Loading your library…</p>
          )}
          {error && <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p>}
        </div>

        {preview && (
          <button type="button" onClick={() => { setPreview(null); setLibrary(null); setServeUnits(null) }} className="mt-4 text-sm text-slate-500 hover:text-slate-700 underline">
            Start over (change source)
          </button>
        )}
      </div>
    </main>
  )
}
