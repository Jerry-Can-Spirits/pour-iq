'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'

const ACTIONS = [
  { label: 'New menu', href: '/new' },
  { label: 'Upload invoice', href: '/invoices/new' },
  { label: 'Add ingredient', href: '/library/new' },
  { label: 'Start stock count', href: '/stock' },
  { label: 'Connect POS', href: '/settings/integrations' },
]

export function AddImportMenu() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={PRIMARY_BUTTON}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        + Add / Import
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="menu" className="absolute right-0 mt-2 w-56 z-40 rounded-lg border border-slate-200 bg-white shadow-xl py-1">
            {ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-slate-900 hover:bg-emerald-50 hover:text-emerald-700"
              >
                {a.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
