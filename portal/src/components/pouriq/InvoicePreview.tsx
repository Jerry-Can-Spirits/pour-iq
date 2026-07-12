'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PreviewPayload } from '@/app/api/pouriq/invoices/extract/route'
import type { IngredientLibraryRow } from '@/lib/pouriq/types'
import { InvoiceLineRow, type LineState } from './InvoiceLineRow'
import { classifyInvoiceLine, summariseInvoiceLines, type InvoiceLineInput } from '@/lib/pouriq/invoice-review'
import { netPriceP } from '@/lib/pouriq/calculations'
import { parsePackFormat } from '@/lib/pouriq/measures'
import { singleContainmentMatch } from '@/lib/pouriq/match'
import { INPUT } from '@/lib/pouriq/ui'
import { PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'
import { InvoiceDocViewer } from './InvoiceDocViewer'

interface Props {
  initial: PreviewPayload
  library: IngredientLibraryRow[]
}

export function InvoicePreview({ initial, library }: Props) {
  const router = useRouter()
  const [supplier, setSupplier] = useState(initial.supplier_name ?? '')
  const [invoiceNumber, setInvoiceNumber] = useState(initial.invoice_number ?? '')
  const [invoiceDate, setInvoiceDate] = useState(initial.invoice_date ?? '')
  const [pricesIncludeVat, setPricesIncludeVat] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAuto, setShowAuto] = useState(false)
  const [showDoc, setShowDoc] = useState(true)
  const attentionRef = useRef<HTMLDivElement>(null)

  const [lines, setLines] = useState<LineState[]>(() =>
    initial.lines.map((l): LineState => {
      if (l.match.kind === 'auto') {
        return {
          applied: true,
          unit_price_p: l.extracted_unit_price_p,
          match: { kind: 'existing', library_id: l.match.library_id },
        }
      }
      if (l.match.kind === 'catalogue') {
        // Pre-stage a new library entry from the catalogue; the bar just sets
        // the price (and ticks Apply) to adopt it.
        const m = l.match
        const pack = m.base_unit === 'ml' ? parsePackFormat(l.extracted_name) : null
        return {
          applied: false,
          unit_price_p: l.extracted_unit_price_p,
          match: {
            kind: 'new',
            new_name: m.name,
            new_type: m.ingredient_type,
            base_unit: m.base_unit,
            pack_size: pack?.pack_size ?? m.default_pack_size ?? (m.base_unit === 'each' ? 1 : 700),
            purchase_qty: pack?.purchase_qty ?? 1,
          },
        }
      }
      const preselect = (l.match.kind === 'suggestions' || l.match.kind === 'no-match')
        ? singleContainmentMatch(l.extracted_name, library)
        : null
      return {
        applied: false,
        unit_price_p: l.extracted_unit_price_p,
        match: { kind: 'existing', library_id: preselect?.id ?? null },
      }
    }),
  )

  const handleChange = useCallback((index: number, patch: Partial<LineState>) => {
    setLines((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }, [])

  const handleToggleCreateNew = useCallback((index: number, toNew: boolean) => {
    setLines((prev) => {
      const next = [...prev]
      const current = next[index]
      if (toNew) {
        const seedName = initial.lines[index].extracted_name
        const pack = parsePackFormat(seedName)
        next[index] = {
          ...current,
          match: {
            kind: 'new',
            new_name: seedName,
            new_type: 'spirit',
            base_unit: 'ml',
            pack_size: pack?.pack_size ?? 700,
            purchase_qty: pack?.purchase_qty ?? 1,
          },
        }
      } else {
        next[index] = {
          ...current,
          match: { kind: 'existing', library_id: null },
        }
      }
      return next
    })
  }, [initial.lines])

  const libraryById = useMemo(() => {
    const m = new Map<string, IngredientLibraryRow>()
    for (const e of library) m.set(e.id, e)
    return m
  }, [library])

  // Per-line review classification (existing data only).
  const lineInputs: InvoiceLineInput[] = initial.lines.map((line, idx) => {
    const st = lines[idx]
    let priceChanged = false
    if (st.match.kind === 'existing' && st.match.library_id) {
      const cur = libraryById.get(st.match.library_id)?.price_p
      priceChanged = cur != null && cur > 0 && netPriceP(st.unit_price_p, pricesIncludeVat) !== cur
    }
    let resolved = true
    if (st.applied) resolved = st.match.kind === 'existing' ? !!st.match.library_id : st.unit_price_p > 0
    return { matchKind: line.match.kind, priceChanged, resolved }
  })
  const summary = summariseInvoiceLines(lineInputs)
  const allIdx = initial.lines.map((_, i) => i)
  const attentionIdx = allIdx.filter((i) => classifyInvoiceLine(lineInputs[i]) === 'needs-attention')
  const priceChangeIdx = allIdx.filter((i) => classifyInvoiceLine(lineInputs[i]) === 'price-change')
  const autoIdx = allIdx.filter((i) => classifyInvoiceLine(lineInputs[i]) === 'auto-ok')

  const thead = (
    <thead className="bg-slate-50">
      <tr className="text-left text-slate-500 text-xs uppercase tracking-widest">
        <th className="px-3 py-3">Apply</th>
        <th className="px-3 py-3">Extracted</th>
        <th className="px-3 py-3">Qty</th>
        <th className="px-3 py-3">New price</th>
        <th className="px-3 py-3">Match</th>
        <th className="px-3 py-3">Current cost</th>
        <th className="px-3 py-3">Change</th>
      </tr>
    </thead>
  )
  const sectionTable = (indices: number[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[820px]">
        {thead}
        <tbody>
          {indices.map((idx) => (
            <InvoiceLineRow
              key={idx}
              index={idx}
              line={initial.lines[idx]}
              state={lines[idx]}
              libraryEntries={library}
              libraryById={libraryById}
              pricesIncludeVat={pricesIncludeVat}
              onChange={handleChange}
              onToggleCreateNew={handleToggleCreateNew}
            />
          ))}
        </tbody>
      </table>
    </div>
  )

  async function handleSave() {
    setError(null)

    const body = {
      ticket: initial.ticket,
      supplier_name: supplier.trim() || null,
      invoice_number: invoiceNumber.trim() || null,
      invoice_date: invoiceDate.trim() || null,
      prices_include_vat: pricesIncludeVat,
      lines: lines.map((s, idx) => {
        const original = initial.lines[idx]
        const base = {
          extracted_name: original.extracted_name,
          extracted_quantity: original.extracted_quantity,
          extracted_unit_price_p: original.extracted_unit_price_p,
          extracted_line_total_p: original.extracted_line_total_p,
          applied: s.applied,
        }
        if (!s.applied) return base
        if (s.match.kind === 'new') {
          return {
            ...base,
            new_library: {
              name: s.match.new_name.trim(),
              ingredient_type: s.match.new_type,
              base_unit: s.match.base_unit,
              pack_size: s.match.base_unit === 'each' ? 1 : s.match.pack_size,
              purchase_qty: s.match.purchase_qty,
              price_p: s.unit_price_p,
            },
            new_cost_p: s.unit_price_p,
          }
        }
        return {
          ...base,
          library_id: s.match.library_id,
          new_cost_p: s.unit_price_p,
        }
      }),
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/pouriq/invoices/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Save failed' })) as { error?: string }
        throw new Error(data.error ?? 'Save failed')
      }
      const data = (await res.json()) as { invoice_id: string }
      const hasApplied = lines.some((l) => l.applied)
      if (hasApplied) {
        router.push(`/invoices/${data.invoice_id}/impact`)
      } else {
        router.push('/library')
      }
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Document above, lines full-width below: the seven-column review table
          needs the whole page, and a half-width pane clipped it. */}
      <div className="print:hidden">
        {showDoc ? (
          <div>
            <InvoiceDocViewer src={`/api/pouriq/invoices/pending/${initial.ticket}`} />
            <button
              type="button"
              onClick={() => setShowDoc(false)}
              className="mt-2 text-xs text-slate-500 hover:text-slate-700"
            >
              Hide document ▲
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDoc(true)}
            className="text-sm text-emerald-700 hover:text-emerald-600 underline"
          >
            Show original invoice ▼
          </button>
        )}
      </div>

      <div>
        <div className="space-y-6">
          {initial.truncated && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This document was long and extraction may be incomplete. Check the last lines against the original before saving.
            </div>
          )}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Invoice details</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="supplier" className="block text-sm font-medium text-slate-700 mb-2">Supplier</label>
                <input id="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label htmlFor="number" className="block text-sm font-medium text-slate-700 mb-2">Invoice number</label>
                <input id="number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-slate-700 mb-2">Date (YYYY-MM-DD)</label>
                <input id="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} placeholder="2026-05-14" className={INPUT} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-emerald-600">● {summary.autoMatched} auto-matched</span>
              <span className="text-slate-400"> · </span>
              <span className="text-amber-600">{summary.needChoice} need a choice</span>
              <span className="text-slate-400"> · </span>
              <span className="text-rose-600">{summary.newProducts} new</span>
              <span className="mt-1 inline-flex items-center gap-2">
                <span className="text-xs text-slate-500">Invoice prices are</span>
                <span role="group" aria-label="Invoice VAT basis" className="inline-flex items-stretch rounded-lg border border-slate-300 overflow-hidden">
                  <button type="button" onClick={() => setPricesIncludeVat(false)} aria-pressed={!pricesIncludeVat}
                    className={`px-2 py-1 text-xs font-semibold ${!pricesIncludeVat ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:text-slate-700 transition-colors'}`}>Ex VAT</button>
                  <span aria-hidden="true" className="w-px bg-slate-300" />
                  <button type="button" onClick={() => setPricesIncludeVat(true)} aria-pressed={pricesIncludeVat}
                    className={`px-2 py-1 text-xs font-semibold ${pricesIncludeVat ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:text-slate-700 transition-colors'}`}>Inc VAT</button>
                </span>
              </span>
            </div>
            {summary.unresolved > 0 && (
              <button
                type="button"
                onClick={() => attentionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="text-sm text-emerald-700 hover:text-emerald-600 underline"
              >
                Jump to decisions ↓
              </button>
            )}
          </div>

          {attentionIdx.length > 0 && (
            <div ref={attentionRef} className="overflow-hidden rounded-xl border border-amber-200">
              <div className="px-4 py-2 text-xs uppercase tracking-widest text-amber-600 bg-amber-50">Needs your attention ({attentionIdx.length})</div>
              {sectionTable(attentionIdx)}
            </div>
          )}

          {priceChangeIdx.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="px-4 py-2 text-xs uppercase tracking-widest text-slate-500">Price changes detected ({priceChangeIdx.length})</div>
              {sectionTable(priceChangeIdx)}
            </div>
          )}

          {autoIdx.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <button type="button" onClick={() => setShowAuto((s) => !s)} className="w-full px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-emerald-600">● {autoIdx.length} auto-matched to existing ingredients</span>
                <span className="text-slate-500">{showAuto ? 'Hide ▲' : 'Review all ▼'}</span>
              </button>
              {showAuto && sectionTable(autoIdx)}
            </div>
          )}

          {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm text-slate-500">
              {summary.unresolved > 0
                ? `${summary.unresolved} line${summary.unresolved === 1 ? '' : 's'} still need a decision.`
                : 'All lines reviewed.'}
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className={PRIMARY_BUTTON}
            >
              {submitting ? 'Saving…' : 'Save invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
