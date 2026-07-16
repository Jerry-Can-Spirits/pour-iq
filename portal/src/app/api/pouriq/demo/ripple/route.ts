// POST /api/pouriq/demo/ripple — the headline demo moment. Loads the
// stored scan-fixture change set (golden rum + ginger beer rises),
// resolves it against The Signal Box's live library, runs the REAL
// ripple engine (loadMultiCostImpact) and returns the per-serve and
// whole-menu GP impact on the affected drinks. No upload, no AI, no D1
// write — only an overlay flag marking the ripple applied this session.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { requireDemoSession } from '@/lib/pouriq/access'
import { readDemoOverlay, withRippleApplied, demoOverlayCookie } from '@/lib/pouriq/demo/overlay'
import { loadMultiCostImpact, type AppliedCostChange } from '@/lib/pouriq/multi-cost-impact'
import {
  DEMO_VENUE_ACCOUNT_ID,
  DEMO_RIPPLE_CHANGES,
  DEMO_SCAN_LINES,
  DEMO_SCAN_SUPPLIER,
  DEMO_SCAN_INVOICE_NUMBER,
  DEMO_SCAN_INVOICE_DATE,
} from '@/lib/pouriq/demo/config'

interface DemoScanLineResult {
  name: string
  quantity: number
  current_cost_p: number
  new_cost_p: number
  changed: boolean
}

export const runtime = 'nodejs'

export async function POST() {
  const sid = await requireDemoSession()
  if (!sid) return NextResponse.json({ error: 'No demo session' }, { status: 403 })

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database

  // Walk the full scanned invoice, resolving each line to the demo venue's
  // library to read its current price as the "before" side. Lines that also
  // appear in the change set carry the invoice's new price and drive the
  // ripple; the rest are shown at current cost with no change. Building both
  // the review rows and the ripple change set in one pass keeps the ripple
  // identical to the prior change-set-only behaviour.
  const changeByName = new Map(DEMO_RIPPLE_CHANGES.map((c) => [c.ingredient_name, c]))
  const scanLines: DemoScanLineResult[] = []
  const changes: AppliedCostChange[] = []
  for (const line of DEMO_SCAN_LINES) {
    const row = await db
      .prepare(
        `SELECT id, price_p FROM pouriq_ingredients_library WHERE trade_account_id = ?1 AND name = ?2 LIMIT 1`,
      )
      .bind(DEMO_VENUE_ACCOUNT_ID, line.ingredient_name)
      .first<{ id: string; price_p: number }>()
    if (!row) continue
    const change = changeByName.get(line.ingredient_name)
    const newCostP = change ? change.new_cost_p : row.price_p
    scanLines.push({
      name: line.ingredient_name,
      quantity: line.quantity,
      current_cost_p: row.price_p,
      new_cost_p: newCostP,
      changed: change != null,
    })
    if (change) {
      changes.push({
        library_ingredient_id: row.id,
        pricing_mode: change.pricing_mode,
        old_cost_p: row.price_p,
        new_cost_p: change.new_cost_p,
      })
    }
  }

  const impact = await loadMultiCostImpact(db, DEMO_VENUE_ACCOUNT_ID, changes)

  // Return the raw engine shapes so the client can render the product's
  // own RipplePreview — no demo-specific copy. Mark the ripple applied in
  // the overlay cookie so a dashboard reload re-shows it.
  const overlay = withRippleApplied(await readDemoOverlay())
  const res = NextResponse.json({
    ok: true,
    scan: {
      supplier_name: DEMO_SCAN_SUPPLIER,
      invoice_number: DEMO_SCAN_INVOICE_NUMBER,
      invoice_date: DEMO_SCAN_INVOICE_DATE,
      lines: scanLines,
    },
    projected: impact.projected,
    rollups: impact.rollups,
  })
  res.cookies.set(demoOverlayCookie(overlay))
  return res
}
