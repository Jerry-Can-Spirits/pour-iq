// POST /api/pouriq/invoices/commit
// JSON body: ticket + header + lines (with applied/library refs)
// Per-applied-line writes (library UPDATE + invoice_line INSERT + cost_change
// INSERT) run as one D1 batch so they are atomic relative to each other.
// New library entries are inserted before their batch and de-duped within
// one invoice so split-line invoices don't create duplicate library rows.

import { NextResponse } from 'next/server'
import * as Sentry from '@/lib/sentry'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isAllowedOrigin, isRateLimited } from '@/lib/kv'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import {
  insertInvoiceHeader,
  insertInvoiceLine,
  finaliseInvoiceTotals,
  receiptTimestamp,
} from '@/lib/pouriq/invoices'
import { type CostPricingMode } from '@/lib/pouriq/cost-changes'
import { getLibraryEntry, insertLibraryEntry } from '@/lib/pouriq/ingredient-library'
import { receiptBottlesFromInvoiceLine } from '@/lib/pouriq/stock'
import { recomputeDependents } from '@/lib/pouriq/prepared'
import { netPriceP } from '@/lib/pouriq/calculations'
import { ALL_INGREDIENT_TYPES, type IngredientType } from '@/lib/pouriq/types'
import { pushInvoiceToAccounting } from '@/lib/pouriq/accounting/push'

export const runtime = 'nodejs'

const COMMIT_RATE_LIMIT = 30

interface CommitLineNewLibrary {
  name: string
  ingredient_type: IngredientType
  base_unit: 'ml' | 'g' | 'each'
  pack_size: number
  purchase_qty: number
  price_p: number
}

interface CommitLine {
  extracted_name: string
  extracted_quantity: number | null
  extracted_unit_price_p: number
  extracted_line_total_p: number | null
  applied: boolean
  library_id?: string
  new_library?: CommitLineNewLibrary
  new_cost_p?: number
}

interface CommitBody {
  ticket: string
  supplier_name: string | null
  invoice_number: string | null
  invoice_date: string | null
  prices_include_vat?: boolean
  lines: CommitLine[]
}

function isPositiveInteger(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0
}

function isNonNegativeInteger(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0
}

function genId(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

function validateBody(body: CommitBody): string | null {
  if (!body.ticket || typeof body.ticket !== 'string') return 'Missing ticket'
  if (body.prices_include_vat !== undefined && typeof body.prices_include_vat !== 'boolean') {
    return 'prices_include_vat must be a boolean'
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0) return 'No lines provided'
  for (let i = 0; i < body.lines.length; i++) {
    const line = body.lines[i]
    if (typeof line.extracted_name !== 'string' || !line.extracted_name.trim()) {
      return `Line ${i + 1}: extracted_name required`
    }
    if (!isNonNegativeInteger(line.extracted_unit_price_p)) {
      return `Line ${i + 1}: extracted_unit_price_p must be a non-negative integer`
    }
    if (line.applied) {
      const hasExisting = typeof line.library_id === 'string' && line.library_id.length > 0
      const hasNew = !!line.new_library
      if (hasExisting === hasNew) {
        return `Line ${i + 1}: applied line must reference exactly one library entry (existing OR new)`
      }
      if (!isNonNegativeInteger(line.new_cost_p)) {
        return `Line ${i + 1}: applied line must include new_cost_p as a non-negative integer`
      }
      if (hasNew && line.new_library) {
        const nl = line.new_library
        if (!nl.name || typeof nl.name !== 'string' || !nl.name.trim()) return `Line ${i + 1}: new library name required`
        if (!ALL_INGREDIENT_TYPES.includes(nl.ingredient_type)) return `Line ${i + 1}: invalid ingredient_type`
        if (!['ml', 'g', 'each'].includes(nl.base_unit)) return `Line ${i + 1}: invalid base_unit`
        if (nl.base_unit !== 'each' && !isPositiveInteger(nl.pack_size)) return `Line ${i + 1}: pack_size must be a positive integer`
        if (!isPositiveInteger(nl.purchase_qty)) return `Line ${i + 1}: purchase_qty must be a positive integer`
        if (!isNonNegativeInteger(nl.price_p)) return `Line ${i + 1}: price_p must be a non-negative integer`
      }
    }
  }
  return null
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace
  const db = env.DB as D1Database
  const r2 = env.TRADE_DOCS as R2Bucket

  if (await isRateLimited(kv, 'pouriq-invoice-commit', access.tradeAccountId, COMMIT_RATE_LIMIT, 3600)) {
    return NextResponse.json({ error: 'Too many commits. Please try again later.' }, { status: 429 })
  }

  let body: CommitBody
  try {
    body = (await request.json()) as CommitBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const validationError = validateBody(body)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  // 1. Insert the invoice header (prices_include_vat written atomically).
  let invoiceId: string
  try {
    invoiceId = await insertInvoiceHeader(db, {
      trade_account_id: access.tradeAccountId,
      supplier_name: body.supplier_name?.trim() || null,
      invoice_number: body.invoice_number?.trim() || null,
      invoice_date: body.invoice_date?.trim() || null,
      line_count: body.lines.length,
      prices_include_vat: body.prices_include_vat === true ? 1 : 0,
    })
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'pouriq-invoice-commit', phase: 'header' } })
    return NextResponse.json({ error: 'Could not save invoice header' }, { status: 500 })
  }

  // 2. Process each line. Applied lines run library + invoice_line + cost_change
  //    as one D1 batch so they're atomic relative to each other. New library
  //    entries are de-duped by normalised name within one invoice.
  let appliedCount = 0
  let netTotalP: number | null = null
  let netSawAny = false
  const newLibraryIdByName = new Map<string, string>()
  const appliedReceipts: Array<{ invoiceLineId: string; libraryId: string; extractedQuantity: number | null }> = []
  const costUpdatedLibraryIds = new Set<string>()

  try {
    for (const line of body.lines) {
      if (!line.applied) {
        // Skipped line — just record for the audit/ledger.
        await insertInvoiceLine(db, {
          invoice_id: invoiceId,
          extracted_name: line.extracted_name,
          extracted_quantity: line.extracted_quantity,
          extracted_unit_price_p: line.extracted_unit_price_p,
          extracted_line_total_p: line.extracted_line_total_p,
          matched_library_id: null,
          applied: false,
        })
        continue
      }

      let libraryId: string
      let pricingMode: CostPricingMode
      let oldCostP: number | null
      // Hoisted before the new_library branch because insertLibraryEntry needs them;
      // netCostP/enteredCostP are derived after newCostP below.
      const includesVat = body.prices_include_vat === true
      const vatFlag = includesVat ? 1 : 0

      if (line.new_library) {
        const dedupeKey = line.new_library.name.trim().toLowerCase()
        const dedupedId = newLibraryIdByName.get(dedupeKey)
        if (dedupedId) {
          // Already created earlier in this invoice. Route through the
          // existing-library path so the second line updates the cost (last
          // wins) and inserts a proper cost_change audit row.
          libraryId = dedupedId
          const existing = await getLibraryEntry(db, libraryId, access.tradeAccountId)
          if (!existing) throw new Error(`Deduped library entry ${libraryId} not found`)
          pricingMode = existing.base_unit === 'each' ? 'unit' : 'bottle'
          oldCostP = existing.price_p
        } else {
          // First sighting of this name in this invoice. Insert the library
          // row now; the per-line batch below records the audit + invoice_line.
          libraryId = await insertLibraryEntry(db, {
            trade_account_id: access.tradeAccountId,
            name: line.new_library.name.trim(),
            ingredient_type: line.new_library.ingredient_type,
            base_unit: line.new_library.base_unit,
            pack_size: line.new_library.pack_size,
            purchase_qty: line.new_library.purchase_qty,
            price_p: netPriceP(line.new_library.price_p, includesVat),
            price_includes_vat: vatFlag,
            price_entered_p: line.new_library.price_p,
            barcode: null,
            notes: null,
          })
          newLibraryIdByName.set(dedupeKey, libraryId)
          pricingMode = line.new_library.base_unit === 'each' ? 'unit' : 'bottle'
          oldCostP = null
        }
      } else {
        if (!line.library_id) throw new Error(`Line is applied but library_id is missing`)
        libraryId = line.library_id
        const existing = await getLibraryEntry(db, libraryId, access.tradeAccountId)
        if (!existing) throw new Error(`Library entry ${libraryId} not found for tenant`)
        pricingMode = existing.base_unit === 'each' ? 'unit' : 'bottle'
        oldCostP = existing.price_p
      }

      if (line.new_cost_p === undefined || line.new_cost_p === null) throw new Error(`Line is applied but new_cost_p is missing`)
      const newCostP = line.new_cost_p
      const netCostP = netPriceP(newCostP, includesVat)
      const enteredCostP = newCostP
      const invoiceLineId = genId()
      const costChangeId = genId()

      // Track this applied line so we can book a stock receipt after the loop.
      appliedReceipts.push({ invoiceLineId, libraryId, extractedQuantity: line.extracted_quantity })

      // Build the atomic batch for this line: optional library UPDATE,
      // invoice_line INSERT, cost_change INSERT. The cost_change references
      // invoice_line by the explicit invoiceLineId we just generated.
      const stmts: D1PreparedStatement[] = []

      const shouldUpdateLibraryCost = oldCostP !== null && netCostP !== oldCostP
      if (shouldUpdateLibraryCost) {
        stmts.push(
          db.prepare(
            `UPDATE pouriq_ingredients_library SET price_p = ?1, price_includes_vat = ?2, price_entered_p = ?3, cost_confidence = 'confirmed', updated_at = datetime('now') WHERE id = ?4 AND trade_account_id = ?5`,
          ).bind(netCostP, vatFlag, enteredCostP, libraryId, access.tradeAccountId),
        )
        costUpdatedLibraryIds.add(libraryId)
      } else {
        // Price unchanged, or a brand-new entry created from this invoice:
        // the line is still invoice-verified, so confirm the cost confidence.
        stmts.push(
          db.prepare(
            `UPDATE pouriq_ingredients_library SET cost_confidence = 'confirmed', updated_at = datetime('now') WHERE id = ?1 AND trade_account_id = ?2`,
          ).bind(libraryId, access.tradeAccountId),
        )
      }

      stmts.push(
        db.prepare(`
          INSERT INTO pouriq_invoice_lines
            (id, invoice_id, extracted_name, extracted_quantity, extracted_unit_price_p, extracted_line_total_p, matched_library_id, applied)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)
        `).bind(
          invoiceLineId,
          invoiceId,
          line.extracted_name,
          line.extracted_quantity,
          line.extracted_unit_price_p,
          line.extracted_line_total_p,
          libraryId,
        ),
      )

      stmts.push(
        db.prepare(`
          INSERT INTO pouriq_cost_changes
            (id, library_ingredient_id, pricing_mode, old_cost_p, new_cost_p, source, invoice_id, invoice_line_id)
          VALUES (?1, ?2, ?3, ?4, ?5, 'invoice', ?6, ?7)
        `).bind(
          costChangeId,
          libraryId,
          pricingMode,
          oldCostP,
          netCostP,
          invoiceId,
          invoiceLineId,
        ),
      )

      await db.batch(stmts)

      appliedCount++
      if (line.extracted_line_total_p !== null) {
        netTotalP = (netTotalP ?? 0) + line.extracted_line_total_p
        netSawAny = true
      }
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'pouriq-invoice-commit', phase: 'lines' }, extra: { invoiceId } })
    // Best-effort rollback of the invoice header. Cascade removes invoice_lines.
    // pouriq_cost_changes rows for already-batched lines survive with
    // invoice_id set to NULL (per ON DELETE SET NULL) — the audit trail of
    // any library UPDATE that did succeed is preserved.
    try { await db.prepare(`DELETE FROM pouriq_invoices WHERE id = ?1`).bind(invoiceId).run() } catch { /* swallow */ }
    // Also delete any library entries created during THIS request so a retry
    // doesn't collide with the unique index (trade_account_id, LOWER(name), pack_size).
    for (const orphanId of newLibraryIdByName.values()) {
      try {
        await db
          .prepare(`DELETE FROM pouriq_ingredients_library WHERE id = ?1 AND trade_account_id = ?2`)
          .bind(orphanId, access.tradeAccountId)
          .run()
      } catch { /* swallow */ }
    }
    return NextResponse.json({ error: 'Could not save invoice lines. Please try again.' }, { status: 500 })
  }

  // 3. Book stock receipts for each applied line that has a quantity.
  //    Failures here must not roll back or 500 the commit — cost application
  //    already succeeded. ON CONFLICT(invoice_line_id) DO NOTHING makes
  //    re-committing the same invoice idempotent.
  try {
    const purchaseQtyRows = await db
      .prepare(`SELECT id, purchase_qty FROM pouriq_ingredients_library WHERE trade_account_id = ?1`)
      .bind(access.tradeAccountId)
      .all<{ id: string; purchase_qty: number }>()
    const purchaseQtyById = new Map<string, number>(
      purchaseQtyRows.results.map((r) => [r.id, r.purchase_qty]),
    )

    const invoiceDateISO = receiptTimestamp(body.invoice_date ?? null, new Date().toISOString())

    for (const receipt of appliedReceipts) {
      const bottles = receiptBottlesFromInvoiceLine(
        receipt.extractedQuantity,
        purchaseQtyById.get(receipt.libraryId) ?? 1,
      )
      if (bottles === null || bottles <= 0) continue
      await db
        .prepare(`
          INSERT INTO pouriq_stock_receipts (trade_account_id, library_ingredient_id, received_at, qty, source, invoice_line_id)
          VALUES (?1, ?2, ?3, ?4, 'invoice', ?5)
          ON CONFLICT(invoice_line_id) DO NOTHING
        `)
        .bind(access.tradeAccountId, receipt.libraryId, invoiceDateISO, bottles, receipt.invoiceLineId)
        .run()
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'pouriq-invoice-commit', feature: 'pouriq-invoices/receipt-booking' },
      extra: { invoiceId },
    })
    // Intentionally swallowed — cost data is committed; receipt booking is
    // best-effort and will not 500 or roll back the response.
  }

  // 4. Propagate cost changes to any prepared recipes that depend on updated
  //    ingredients. Best-effort: failures must not break the commit response.
  for (const updatedId of costUpdatedLibraryIds) {
    // Per-ingredient so one failure doesn't skip the rest. Best-effort:
    // cost data is committed; recompute failures must not 500 or roll back.
    try {
      await recomputeDependents(db, access.tradeAccountId, updatedId)
    } catch (err) {
      Sentry.captureException(err, {
        tags: { route: 'pouriq-invoice-commit', feature: 'pouriq-invoices/prepared-recompute' },
        extra: { invoiceId, updatedId },
      })
    }
  }

  // 6. Move the R2 PDF from _pending/ to its permanent tenant-namespaced key.
  let r2Key: string | null = null
  try {
    const pendingKey = `pouriq-invoices/_pending/${body.ticket}.pdf`
    const obj = await r2.get(pendingKey)
    if (obj) {
      const buffer = await obj.arrayBuffer()
      const permKey = `pouriq-invoices/${access.tradeAccountId}/${invoiceId}.pdf`
      await r2.put(permKey, buffer, {
        httpMetadata: { contentType: 'application/pdf' },
        customMetadata: { tradeAccountId: access.tradeAccountId, invoiceId, ts: new Date().toISOString() },
      })
      await r2.delete(pendingKey)
      r2Key = permKey
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'pouriq-invoice-commit', phase: 'r2-move' }, extra: { invoiceId } })
    // Don't fail the commit. r2_key stays null; Download PDF will be hidden.
  }

  // 7. Finalise totals on the invoice row.
  try {
    await finaliseInvoiceTotals(db, invoiceId, appliedCount, netSawAny ? netTotalP : null, r2Key)
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'pouriq-invoice-commit', phase: 'finalise' }, extra: { invoiceId } })
    return NextResponse.json({ error: 'Could not finalise invoice. Please contact support.' }, { status: 500 })
  }

  // 8. Push to the venue's connected accounting software. Best-effort and
  //    internally non-throwing: a failed push lands in the retry queue and
  //    must never fail the commit.
  await pushInvoiceToAccounting(db, env, access.tradeAccountId, invoiceId)

  return NextResponse.json({ invoice_id: invoiceId })
}
