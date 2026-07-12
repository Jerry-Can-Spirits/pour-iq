import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Full tenant data export, as promised by the marketing FAQ ("a full export
// of your data is available on request") — one JSON document of everything
// the venue owns. Deliberately excluded: POS/accounting connection rows
// (they hold encrypted OAuth secrets, not venue data), internal push/state
// bookkeeping, and the shared catalogues (not tenant data). Original
// invoice PDFs are downloadable per invoice via /api/pouriq/invoices/[id]/pdf;
// each invoice row below carries its id for that purpose.

// Tables owned directly by the tenant.
const DIRECT = [
  'pouriq_menus',
  'pouriq_ingredients_library',
  'pouriq_invoices',
  'pouriq_voice_profiles',
  'pouriq_subscriptions',
  'pouriq_stock_count_events',
  'pouriq_stock_receipts',
  'pouriq_pos_item_map',
  'pouriq_production_events',
] as const

// Child tables reached through an owned parent.
const JOINED: ReadonlyArray<{ table: string; via: string }> = [
  { table: 'pouriq_cocktails', via: 'menu_id IN (SELECT id FROM pouriq_menus WHERE trade_account_id = ?1)' },
  { table: 'pouriq_menu_sections', via: 'menu_id IN (SELECT id FROM pouriq_menus WHERE trade_account_id = ?1)' },
  { table: 'pouriq_analyses', via: 'menu_id IN (SELECT id FROM pouriq_menus WHERE trade_account_id = ?1)' },
  { table: 'pouriq_stock_counts', via: 'menu_id IN (SELECT id FROM pouriq_menus WHERE trade_account_id = ?1)' },
  { table: 'pouriq_ingredients', via: 'cocktail_id IN (SELECT c.id FROM pouriq_cocktails c JOIN pouriq_menus m ON m.id = c.menu_id WHERE m.trade_account_id = ?1)' },
  { table: 'pouriq_drink_volumes', via: 'cocktail_id IN (SELECT c.id FROM pouriq_cocktails c JOIN pouriq_menus m ON m.id = c.menu_id WHERE m.trade_account_id = ?1)' },
  { table: 'pouriq_invoice_lines', via: 'invoice_id IN (SELECT id FROM pouriq_invoices WHERE trade_account_id = ?1)' },
  { table: 'pouriq_cost_changes', via: 'library_ingredient_id IN (SELECT id FROM pouriq_ingredients_library WHERE trade_account_id = ?1)' },
  { table: 'pouriq_ingredient_serve_units', via: 'library_ingredient_id IN (SELECT id FROM pouriq_ingredients_library WHERE trade_account_id = ?1)' },
  { table: 'pouriq_ingredient_uses', via: 'ingredient_id IN (SELECT id FROM pouriq_ingredients_library WHERE trade_account_id = ?1)' },
  { table: 'pouriq_prepared_components', via: 'prepared_ingredient_id IN (SELECT id FROM pouriq_ingredients_library WHERE trade_account_id = ?1)' },
  { table: 'pouriq_production_components', via: 'production_event_id IN (SELECT id FROM pouriq_production_events WHERE trade_account_id = ?1)' },
]

export async function GET() {
  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { env } = getCloudflareContext()
  const db = env.DB as D1Database
  const tenantId = access.tradeAccountId

  const data: Record<string, unknown[]> = {}
  for (const table of DIRECT) {
    const rows = await db
      .prepare(`SELECT * FROM ${table} WHERE trade_account_id = ?1`)
      .bind(tenantId)
      .all()
    data[table] = rows.results ?? []
  }
  for (const { table, via } of JOINED) {
    const rows = await db.prepare(`SELECT * FROM ${table} WHERE ${via}`).bind(tenantId).all()
    data[table] = rows.results ?? []
  }

  const venue = await db
    .prepare(`SELECT venue_name, tier, created_at FROM trade_accounts WHERE id = ?1`)
    .bind(tenantId)
    .first()

  const body = JSON.stringify(
    {
      format: 'pour-iq-export',
      version: 1,
      exported_at: new Date().toISOString(),
      venue,
      note: 'Original invoice PDFs are available per invoice at /api/pouriq/invoices/{id}/pdf while your account is active.',
      data,
    },
    null,
    2,
  )

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="pour-iq-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
