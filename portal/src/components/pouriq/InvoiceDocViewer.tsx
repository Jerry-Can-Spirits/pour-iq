'use client'

export function InvoiceDocViewer({ src, title }: { src: string | null; title?: string }) {
  if (!src) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
        No document available.
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
        <span className="text-xs font-medium text-slate-500">{title ?? 'Original invoice'}</span>
        <a href={src} target="_blank" rel="noopener" className="text-xs text-emerald-700 hover:text-emerald-600 underline">Open in new tab</a>
      </div>
      <iframe src={src} title={title ?? 'Invoice document'} className="w-full min-h-[60vh]" />
    </div>
  )
}
