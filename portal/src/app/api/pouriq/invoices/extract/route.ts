// POST /api/pouriq/invoices/extract
// JSON body: { ticket: string }
// Loads the uploaded PDF from R2, runs Claude extraction, matches each line
// against the tenant library, returns preview payload.

import { NextResponse } from 'next/server'
import * as Sentry from '@/lib/sentry'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isAllowedOrigin, isRateLimited } from '@/lib/kv'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { listLibraryEntries } from '@/lib/pouriq/ingredient-library'
import { extractInvoiceWithAnthropic } from '@/lib/pouriq/invoice-extract'
import { matchInvoiceLine } from '@/lib/pouriq/invoice-match'
import { listCatalogue, matchCatalogue, adoptionName } from '@/lib/pouriq/ingredient-catalogue'
import type { IngredientType } from '@/lib/pouriq/types'

export const runtime = 'nodejs'

const EXTRACT_RATE_LIMIT = 60

export interface PreviewLine {
  extracted_name: string
  extracted_quantity: number | null
  extracted_unit_price_p: number
  extracted_line_total_p: number | null
  match:
    | { kind: 'auto'; library_id: string; library_name: string }
    | { kind: 'suggestions'; entries: Array<{ id: string; name: string }> }
    | { kind: 'catalogue'; catalogue_id: string; name: string; ingredient_type: IngredientType; base_unit: 'ml' | 'g' | 'each'; default_pack_size: number | null }
    | { kind: 'no-match' }
}

export interface PreviewPayload {
  ticket: string
  supplier_name: string | null
  invoice_number: string | null
  invoice_date: string | null
  lines: PreviewLine[]
  truncated?: boolean
}

interface Body { ticket: string }

function bufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64')
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

  if (!env.ANTHROPIC_API_KEY) {
    Sentry.captureMessage('pouriq-invoice-extract: ANTHROPIC_API_KEY missing', { tags: { route: 'pouriq-invoice-extract', phase: 'config' } })
    return NextResponse.json({ error: 'Invoice scanning is temporarily unavailable. Please try again later.' }, { status: 503 })
  }

  if (await isRateLimited(kv, 'pouriq-invoice-extract', access.tradeAccountId, EXTRACT_RATE_LIMIT, 3600)) {
    return NextResponse.json({ error: 'Too many extractions. Please try again later.' }, { status: 429 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.ticket || typeof body.ticket !== 'string') {
    return NextResponse.json({ error: 'Missing ticket' }, { status: 400 })
  }

  const pdfR2Key = `pouriq-invoices/_pending/${body.ticket}.pdf`
  const obj = await r2.get(pdfR2Key)
  if (!obj) {
    return NextResponse.json({ error: 'Upload expired. Please re-upload the PDF.' }, { status: 400 })
  }
  // Defense-in-depth: verify the uploader tenant matches the requester.
  // Tickets are crypto.randomUUID() so guessing is infeasible, but a leaked
  // ticket must not let another tenant extract from someone else's invoice.
  if (obj.customMetadata?.tradeAccountId !== access.tradeAccountId) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  }
  const buffer = await obj.arrayBuffer()
  const pdfBase64 = bufferToBase64(buffer)

  let extracted
  try {
    extracted = await extractInvoiceWithAnthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      pdfBase64,
    })
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'pouriq-invoice-extract', phase: 'anthropic' } })
    return NextResponse.json({ error: 'Could not read your invoice. Try a clearer scan.' }, { status: 502 })
  }

  if (extracted.stopReason === 'max_tokens') {
    Sentry.captureMessage('pouriq-invoice-extract: hit max_tokens', {
      level: 'warning',
      tags: { route: 'pouriq-invoice-extract', phase: 'anthropic', stop_reason: 'max_tokens' },
      extra: { lineCount: extracted.result.lines?.length ?? 0 },
    })
  }

  if (!extracted.result.lines || extracted.result.lines.length === 0) {
    Sentry.captureMessage('pouriq-invoice-extract: empty lines array', {
      level: 'warning',
      tags: { route: 'pouriq-invoice-extract', phase: 'anthropic' },
    })
    return NextResponse.json({ error: 'No items found in invoice. Try a clearer scan.' }, { status: 422 })
  }

  const library = await listLibraryEntries(db, access.tradeAccountId)
  const catalogue = await listCatalogue(db)
  const lines: PreviewLine[] = extracted.result.lines.map((line) => {
    const matched = matchInvoiceLine(line.extracted_name, library)
    let match: PreviewLine['match']
    if (matched.kind === 'auto') {
      // The bar's own priced library entry always wins.
      match = { kind: 'auto', library_id: matched.entry.id, library_name: matched.entry.name }
    } else {
      // Not in their library — offer a shared-catalogue adoption (set price).
      const cat = matchCatalogue(line.extracted_name, catalogue)
      if (cat) {
        match = {
          kind: 'catalogue',
          catalogue_id: cat.id,
          name: adoptionName(line.extracted_name, cat),
          ingredient_type: cat.ingredient_type,
          base_unit: cat.base_unit,
          default_pack_size: cat.default_pack_size,
        }
      } else if (matched.kind === 'suggestions') {
        match = {
          kind: 'suggestions',
          entries: matched.entries.map((e) => ({ id: e.id, name: e.name })),
        }
      } else {
        match = { kind: 'no-match' }
      }
    }
    return {
      extracted_name: line.extracted_name,
      extracted_quantity: line.extracted_quantity,
      extracted_unit_price_p: line.extracted_unit_price_p,
      extracted_line_total_p: line.extracted_line_total_p,
      match,
    }
  })

  const payload: PreviewPayload = {
    ticket: body.ticket,
    supplier_name: extracted.result.supplier_name,
    invoice_number: extracted.result.invoice_number,
    invoice_date: extracted.result.invoice_date,
    lines,
    truncated: extracted.stopReason === 'max_tokens' ? true : undefined,
  }

  return NextResponse.json(payload)
}
