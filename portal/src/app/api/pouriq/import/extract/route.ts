// POST /api/pouriq/import/extract
// JSON body: { menuId: string, source: 'text', text: string }
//        or: { menuId: string, source: 'pdf', ticket: string }
// Returns the extraction preview with per-ingredient match status.

import { NextResponse } from 'next/server'
import * as Sentry from '@/lib/sentry'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isAllowedOrigin, isRateLimited } from '@/lib/kv'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { getMenu } from '@/lib/pouriq/menus'
import { listLibraryEntries } from '@/lib/pouriq/ingredient-library'
import { extractMenuWithAnthropic } from '@/lib/pouriq/menu-extract'
import { parseMeasurement } from '@/lib/pouriq/measurement-parse'
import { matchIngredient } from '@/lib/pouriq/match'
import { listCatalogue, matchCatalogue, adoptionName } from '@/lib/pouriq/ingredient-catalogue'
import { splitCompoundIngredients } from '@/lib/pouriq/compound'
import type { IngredientType } from '@/lib/pouriq/types'
import type { ServeToken } from '@/lib/pouriq/serve-map'
import { coerceServeToken } from '@/lib/pouriq/serve-map'

export const runtime = 'nodejs'

const EXTRACT_RATE_LIMIT = 60 // per hour per tenant

interface TextBody { menuId: string; source: 'text'; text: string }
interface PdfBody { menuId: string; source: 'pdf'; ticket: string }
type Body = TextBody | PdfBody

export interface PreviewIngredient {
  extracted_name: string
  base_product: string | null
  serve: ServeToken | null
  raw_measurement: string
  inferred_type: IngredientType
  parsed: ReturnType<typeof parseMeasurement>
  match:
    | { kind: 'auto'; library_id: string; library_name: string }
    | { kind: 'suggestions'; entries: Array<{ id: string; name: string }> }
    | { kind: 'catalogue'; catalogue_id: string; name: string; ingredient_type: IngredientType; base_unit: 'ml' | 'g' | 'each'; default_pack_size: number | null }
    | { kind: 'no-match' }
}

export interface PreviewDrink {
  name: string
  sale_price_p: number | null
  ingredients: PreviewIngredient[]
}

export interface PreviewPayload {
  drinks: PreviewDrink[]
  source_text_preview: string
  truncated?: boolean
}

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
    Sentry.captureMessage('pouriq-import-extract: ANTHROPIC_API_KEY missing', { tags: { route: 'pouriq-import-extract', phase: 'config' } })
    return NextResponse.json({ error: 'Menu import is temporarily unavailable. Please try again later.' }, { status: 503 })
  }

  if (await isRateLimited(kv, 'pouriq-import-extract', access.tradeAccountId, EXTRACT_RATE_LIMIT, 3600)) {
    return NextResponse.json({ error: 'Too many extractions. Please try again later.' }, { status: 429 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const menu = await getMenu(db, body.menuId, access.tradeAccountId)
  if (!menu) {
    return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
  }

  // 1. Resolve source — either pasted text or a PDF held in R2.
  let menuText: string | undefined
  let pdfBase64: string | undefined
  let pdfR2Key: string | null = null
  if (body.source === 'text') {
    menuText = body.text?.trim() ?? ''
    if (!menuText) {
      return NextResponse.json({ error: 'Empty text' }, { status: 400 })
    }
    if (menuText.length > 50_000) {
      return NextResponse.json({ error: 'Text too long (max 50,000 characters)' }, { status: 400 })
    }
  } else {
    pdfR2Key = `pouriq-imports/${body.ticket}`
    const obj = await r2.get(pdfR2Key)
    if (!obj) {
      return NextResponse.json({ error: 'Upload expired — please re-upload the PDF' }, { status: 400 })
    }
    // Defense-in-depth: verify the uploader tenant matches the requester.
    // Tickets are crypto.randomUUID() so guessing is infeasible, but a leaked
    // ticket must not let another tenant extract from someone else's PDF.
    if (obj.customMetadata?.tradeAccountId !== access.tradeAccountId) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
    }
    const buffer = await obj.arrayBuffer()
    pdfBase64 = bufferToBase64(buffer)
  }

  // 2. Call Anthropic — model reads either text or the PDF document block directly.
  let extracted
  try {
    extracted = await extractMenuWithAnthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      menuText,
      pdfBase64,
    })
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'pouriq-import-extract', phase: 'anthropic' } })
    return NextResponse.json({ error: 'Could not read your menu — try again or paste the text directly' }, { status: 502 })
  }

  if (extracted.stopReason === 'max_tokens') {
    Sentry.captureMessage('pouriq-import-extract: hit max_tokens', {
      level: 'warning',
      tags: { route: 'pouriq-import-extract', phase: 'anthropic', stop_reason: 'max_tokens' },
      extra: { drinkCount: extracted.result.drinks?.length ?? 0, source: body.source },
    })
  }

  if (!extracted.result.drinks || extracted.result.drinks.length === 0) {
    Sentry.captureMessage('pouriq-import-extract: empty drinks array', {
      level: 'warning',
      tags: { route: 'pouriq-import-extract', phase: 'anthropic', stop_reason: extracted.stopReason },
      extra: { source: body.source, model: extracted.usage.model },
    })
    return NextResponse.json({ error: 'No drinks found in the source — try editing the source text' }, { status: 422 })
  }

  // 3. Load the tenant's library and the shared catalogue once for matching
  const library = await listLibraryEntries(db, access.tradeAccountId)
  const catalogue = await listCatalogue(db)

  // 4. Build the preview payload
  const drinks: PreviewDrink[] = extracted.result.drinks.map((d) => ({
    name: d.name,
    sale_price_p: d.sale_price_p,
    ingredients: splitCompoundIngredients(d.ingredients).map((i): PreviewIngredient => {
      const parsed = parseMeasurement(i.raw_measurement)
      const matchName = i.base_product?.trim() || i.name
      const matched = matchIngredient(matchName, library)
      let match: PreviewIngredient['match']
      if (matched.kind === 'auto') {
        // The bar's own priced library entry always wins.
        match = { kind: 'auto', library_id: matched.entry.id, library_name: matched.entry.name }
      } else {
        // Not in their library — offer a shared-catalogue adoption (set price).
        const cat = matchCatalogue(matchName, catalogue, i.inferred_type)
        if (cat) {
          match = {
            kind: 'catalogue',
            catalogue_id: cat.id,
            name: adoptionName(matchName, cat),
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
        extracted_name: i.name,
        base_product: typeof i.base_product === 'string' && i.base_product.trim() ? i.base_product.trim() : null,
        serve: coerceServeToken(i.serve),
        raw_measurement: i.raw_measurement,
        inferred_type: i.inferred_type,
        parsed,
        match,
      }
    }),
  }))

  const payload: PreviewPayload = {
    drinks,
    source_text_preview: menuText ? menuText.slice(0, 500) : '',
    truncated: extracted.stopReason === 'max_tokens' ? true : undefined,
  }

  if (pdfR2Key) {
    try { await r2.delete(pdfR2Key) } catch { /* swallow */ }
  }

  return NextResponse.json(payload)
}
