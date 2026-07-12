'use client'

import { type ReactNode, useState } from 'react'
import { InvoiceDocViewer } from './InvoiceDocViewer'

interface Props {
  docSrc: string | null
  children: ReactNode
}

export function InvoiceDetailPanes({ docSrc, children }: Props) {
  const [pane, setPane] = useState<'lines' | 'doc'>('lines')

  return (
    <div>
      <div className="flex rounded-lg border border-slate-300 overflow-hidden mb-4 lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setPane('doc')}
          aria-pressed={pane === 'doc'}
          className={`flex-1 px-4 py-2 text-sm font-medium ${pane === 'doc' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:text-slate-800 transition-colors'}`}
        >
          Document
        </button>
        <span aria-hidden="true" className="w-px bg-slate-300" />
        <button
          type="button"
          onClick={() => setPane('lines')}
          aria-pressed={pane === 'lines'}
          className={`flex-1 px-4 py-2 text-sm font-medium ${pane === 'lines' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:text-slate-800 transition-colors'}`}
        >
          Lines
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
        <div className={`${pane === 'doc' ? '' : 'hidden'} lg:block print:hidden`}>
          <InvoiceDocViewer src={docSrc} />
        </div>

        <div className={`${pane === 'lines' ? '' : 'hidden'} lg:block space-y-6`}>
          {children}
        </div>
      </div>
    </div>
  )
}
