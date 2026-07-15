// POST /api/pouriq/demo/ripple — the headline demo moment. Loads the
// stored scan-fixture change set (golden rum + ginger beer rises),
// resolves it against The Signal Box's live library, runs the REAL
// ripple engine (loadMultiCostImpact) and returns the per-serve and
// whole-menu GP impact on the affected drinks. No upload, no AI, no D1
// write — only an overlay flag marking the ripple applied this session.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { requireDemoSession } from '@/lib/pouriq/access'
import { setDemoRippleApplied } from '@/lib/pouriq/demo/overlay'
import { loadMultiCostImpact, type AppliedCostChange } from '@/lib/pouriq/multi-cost-impact'
import { DEMO_VENUE_ACCOUNT_ID, DEMO_RIPPLE_CHANGES } from '@/lib/pouriq/demo/config'

export const runtime = 'nodejs'

export async function POST() {
  const sid = await requireDemoSession()
  if (!sid) return NextResponse.json({ error: 'No demo session' }, { status: 403 })

  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace
  const db = env.DB as D1Database

  // Resolve the fixture change set to library ids by name, scoped to the
  // demo venue, reading each ingredient's current price as the "before"
  // side so the ripple reflects live base data.
  const changes: AppliedCostChange[] = []
  for (const change of DEMO_RIPPLE_CHANGES) {
    const row = await db
      .prepare(
        `SELECT id, price_p FROM pouriq_ingredients_library WHERE trade_account_id = ?1 AND name = ?2 LIMIT 1`,
      )
      .bind(DEMO_VENUE_ACCOUNT_ID, change.ingredient_name)
      .first<{ id: string; price_p: number }>()
    if (!row) continue
    changes.push({
      library_ingredient_id: row.id,
      pricing_mode: change.pricing_mode,
      old_cost_p: row.price_p,
      new_cost_p: change.new_cost_p,
    })
  }

  const impact = await loadMultiCostImpact(db, DEMO_VENUE_ACCOUNT_ID, changes)
  await setDemoRippleApplied(kv, sid)

  // Return the raw engine shapes so the client can render the product's
  // own RipplePreview — no demo-specific copy.
  return NextResponse.json({
    ok: true,
    projected: impact.projected,
    rollups: impact.rollups,
  })
}
