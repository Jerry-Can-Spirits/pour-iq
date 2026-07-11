'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import type { NavLink } from './nav-links'

// The only client island in the marketing shell: a disclosure menu that
// traps focus while open, closes on Escape, and overlays the page (absolute
// against the sticky header) so opening it never shifts layout.
export function MobileMenu({ links }: { links: readonly NavLink[] }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    rootRef.current?.querySelector<HTMLElement>(`[id="${panelId}"] a`)?.focus()
  }, [open, panelId])

  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!open) return
    if (event.key === 'Escape') {
      close()
      return
    }
    if (event.key !== 'Tab' || !rootRef.current) return
    // Trap: the toggle button and the panel links are the only tab stops.
    const focusable = Array.from(rootRef.current.querySelectorAll<HTMLElement>('button, a[href]'))
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div ref={rootRef} className="lg:hidden" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="flex size-10 items-center justify-center rounded-md text-chalk transition-colors duration-(--pour-duration-fast) ease-pour hover:bg-backbar"
      >
        <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="size-6"
        >
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-backbar bg-cellar"
      >
        <nav aria-label="Primary" className="px-4 py-4 sm:px-6">
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-3 font-medium text-chalk transition-colors duration-(--pour-duration-fast) ease-pour hover:bg-backbar"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
