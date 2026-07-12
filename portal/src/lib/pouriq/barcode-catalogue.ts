// Read/write helpers for the shared cross-tenant barcode catalogue.
//
// Reads are public — any authenticated trade user can look up by barcode.
// Writes happen automatically when a tenant saves a library entry that
// carries a barcode. First contributor wins on naming; subsequent
// contributors raise the contributor_count, and once that reaches 3+
// the entry is auto-verified as a soft popularity signal.

import type { IngredientType } from './types'

export interface BarcodeCatalogueEntry {
  barcode: string
  name: string
  ingredient_type: IngredientType
  pack_size_ml: number | null
  contributor_count: number
  verified: number
}

const AUTO_VERIFY_THRESHOLD = 3

export async function findCatalogueEntry(
  db: D1Database,
  barcode: string,
): Promise<BarcodeCatalogueEntry | null> {
  return await db
    .prepare(`
      SELECT barcode, name, ingredient_type, pack_size_ml, contributor_count, verified
      FROM pouriq_barcode_catalogue
      WHERE barcode = ?1
    `)
    .bind(barcode)
    .first<BarcodeCatalogueEntry>()
}

interface ContributeInput {
  barcode: string
  name: string
  ingredient_type: IngredientType
  pack_size_ml: number | null
  trade_account_id: string
}

/**
 * Insert this product into the shared catalogue if new; otherwise just
 * bump the contributor count. Never overwrites the existing name/type
 * (first contributor wins) — JCS can curate manually via D1 console.
 * Auto-flips verified=1 once enough distinct contributors have seen it.
 */
export async function contributeToCatalogue(
  db: D1Database,
  input: ContributeInput,
): Promise<void> {
  const existing = await findCatalogueEntry(db, input.barcode)
  if (!existing) {
    await db
      .prepare(`
        INSERT INTO pouriq_barcode_catalogue
          (barcode, name, ingredient_type, pack_size_ml, first_contributor_account_id)
        VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT(barcode) DO NOTHING
      `)
      .bind(input.barcode, input.name, input.ingredient_type, input.pack_size_ml, input.trade_account_id)
      .run()
    return
  }
  const nextCount = existing.contributor_count + 1
  const verified = existing.verified === 1 || nextCount >= AUTO_VERIFY_THRESHOLD ? 1 : 0
  await db
    .prepare(`
      UPDATE pouriq_barcode_catalogue
      SET contributor_count = ?1,
          verified = ?2,
          updated_at = datetime('now')
      WHERE barcode = ?3
    `)
    .bind(nextCount, verified, input.barcode)
    .run()
}
