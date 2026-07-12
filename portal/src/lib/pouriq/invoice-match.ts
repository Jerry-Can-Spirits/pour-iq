import { matchIngredient, type MatchStatus } from './match'
import type { IngredientLibraryRow } from './types'

const SIZE_RE = /(\d+(?:\.\d+)?)\s?(ml|cl|l)\b/i

function extractSizeMl(name: string): number | null {
  const m = name.match(SIZE_RE)
  if (!m) return null
  const n = parseFloat(m[1])
  const unit = m[2].toLowerCase()
  if (!Number.isFinite(n) || n <= 0) return null
  if (unit === 'ml') return Math.round(n)
  if (unit === 'cl') return Math.round(n * 10)
  if (unit === 'l') return Math.round(n * 1000)
  return null
}

function normaliseForCompare(name: string): string {
  return name
    .toLowerCase()
    .replace(/['.,]/g, '')
    .replace(/\b(\d+(?:\.\d+)?\s?(?:ml|cl|l|oz))\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Match an extracted invoice line name against the tenant's library, preferring
 * entries whose pack_size matches a size suffix on the extracted name.
 * Avoids silently updating the 70cl Smirnoff library row from a 1L invoice line.
 *
 * Rules when the extracted name carries a size suffix:
 * 1. Base match auto + size agrees → keep the auto match (common case).
 * 2. Base match auto + size mismatches → look for a size-correct candidate
 *    whose normalised name otherwise matches the base entry (same product,
 *    different size). If found, auto-promote to it. The user wanted the
 *    size-correct entry; we have high confidence.
 * 3. Base match auto + size mismatches + no clean candidate exists → demote
 *    to suggestions on the base entry alone, so the user must explicitly
 *    confirm before any cost write. Never silently apply to the wrong size.
 * 4. Base match suggestions → re-rank to put size-correct candidates first.
 *
 * When the extracted name has no size suffix, returns the base match unchanged.
 */
export function matchInvoiceLine(
  extractedName: string,
  library: IngredientLibraryRow[],
): MatchStatus {
  const baseMatch = matchIngredient(extractedName, library)
  const sizeMl = extractSizeMl(extractedName)
  if (sizeMl === null) return baseMatch

  if (baseMatch.kind === 'auto') {
    if ((baseMatch.entry.base_unit === 'ml' ? baseMatch.entry.pack_size : null) === sizeMl) return baseMatch

    // Look for a size-correct candidate whose normalised name matches the
    // base entry (same product at the right size). Auto-promote to it.
    const baseNorm = normaliseForCompare(baseMatch.entry.name)
    const sizeAndNameMatch = library.find(
      (e) =>
        (e.base_unit === 'ml' ? e.pack_size : null) === sizeMl &&
        e.id !== baseMatch.entry.id &&
        normaliseForCompare(e.name) === baseNorm,
    )
    if (sizeAndNameMatch) return { kind: 'auto', entry: sizeAndNameMatch }

    // Failing that, any size-correct candidate at all becomes the top
    // suggestion alongside the base.
    const sizeMatch = library.find(
      (e) => (e.base_unit === 'ml' ? e.pack_size : null) === sizeMl && e.id !== baseMatch.entry.id,
    )
    if (sizeMatch) {
      return { kind: 'suggestions', entries: [sizeMatch, baseMatch.entry] }
    }

    // No size-correct candidate anywhere. The auto match is the wrong size,
    // and silently applying it would mis-price every cocktail that uses the
    // base entry. Demote to suggestions so the user must confirm or create
    // a new entry at the correct size.
    return { kind: 'suggestions', entries: [baseMatch.entry] }
  }

  if (baseMatch.kind === 'suggestions') {
    const sizeMatches = baseMatch.entries.filter((e) => (e.base_unit === 'ml' ? e.pack_size : null) === sizeMl)
    const others = baseMatch.entries.filter((e) => (e.base_unit === 'ml' ? e.pack_size : null) !== sizeMl)
    return { kind: 'suggestions', entries: [...sizeMatches, ...others] }
  }

  return baseMatch
}
