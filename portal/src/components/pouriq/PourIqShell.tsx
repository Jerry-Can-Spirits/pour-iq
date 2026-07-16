'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_GROUPS, isNavActive } from '@/lib/pouriq/nav'
import { isBlockedForDemo } from '@/lib/pouriq/demo/config'
import { AddImportMenu } from './AddImportMenu'
import { PourIqWordmark } from './PourIqWordmark'
import { DemoBanner } from './demo/DemoBanner'

export function PourIqShell({
  venueName,
  demo = false,
  children,
}: {
  venueName: string
  demo?: boolean
  children: ReactNode
}) {
  const pathname = usePathname()
  const [navOpen, setNavOpen] = useState(false)

  // In the demo, hide nav items that would 403 for the demo role (the
  // /settings surfaces), so visitors never hit a dead end. Groups left
  // empty by the filter are dropped.
  const navGroups = demo
    ? NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !isBlockedForDemo(i.href, 'GET')) })).filter(
        (g) => g.items.length > 0,
      )
    : NAV_GROUPS

  const nav = (
    <nav aria-label="Pour IQ" className="px-3 py-4 space-y-5">
      {navGroups.map((group) => (
        <div key={group.label}>
          <div className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">{group.label}</div>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isNavActive(pathname, item.href)
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setNavOpen(false)}
                    className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-emerald-50 text-emerald-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      <div className="pt-3 mt-1 border-t border-slate-200">
        <Link
          href="https://pour-iq.co.uk"
          onClick={() => setNavOpen(false)}
          className="block rounded-md px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          ← pour-iq.co.uk
        </Link>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {demo && <div className="no-print"><DemoBanner /></div>}
      <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setNavOpen((o) => !o)}
            className="lg:hidden text-slate-500 hover:text-slate-900"
            aria-label="Menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <Link href="/" className="flex items-center gap-3 min-w-0">
            <PourIqWordmark />
            <span className="text-slate-400 text-sm truncate border-l border-slate-200 pl-3">{venueName}</span>
          </Link>
        </div>
        {/* Add/Import triggers writes and AI — hidden in the read-mostly demo. */}
        {!demo && <AddImportMenu />}
      </header>

      <div className="flex">
        <aside className="no-print hidden lg:block w-56 shrink-0 border-r border-slate-200 bg-white min-h-[calc(100vh-57px)]">
          {nav}
        </aside>

        {navOpen && (
          <div className="no-print lg:hidden fixed inset-0 z-30">
            <div className="absolute inset-0 bg-black/50" onClick={() => setNavOpen(false)} aria-hidden="true" />
            <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 overflow-y-auto">
              {nav}
            </aside>
          </div>
        )}

        <div id="main-content" className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}
