'use client'

import { useState, type ReactNode } from 'react'

// In-page tabs for long pages with several distinct areas. The tab strip is
// screen-only; every panel stays in the document (inactive ones hidden on
// screen, shown on paper) so a page that also prints as a report — the menu
// page — still prints in full. Each panel keeps its own section headings, so
// the printed report reads the same with or without the tabs.

export interface TabPanel {
  id: string
  label: string
  content: ReactNode
}

export function Tabs({ panels, ariaLabel }: { panels: TabPanel[]; ariaLabel: string }) {
  const [active, setActive] = useState(panels[0]?.id ?? '')

  return (
    <div>
      <div role="tablist" aria-label={ariaLabel} className="no-print flex flex-wrap gap-1 border-b border-slate-200 mb-8">
        {panels.map((p) => {
          const isActive = p.id === active
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(p.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-emerald-600 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      {panels.map((p) => (
        <div key={p.id} role="tabpanel" className={p.id === active ? 'block' : 'hidden print:block'}>
          {p.content}
        </div>
      ))}
    </div>
  )
}
