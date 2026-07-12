// Single source of truth for the legal pages' "Last updated" lines.
// These dates are changed manually, and only when the corresponding
// document's content changes; they must never be derived from build
// time, deploy time, or the current date.
export const termsLastUpdated = '2026-07-12'
export const privacyLastUpdated = '2026-07-12'

/** "2026-07-12" → "12 July 2026" (en-GB, no ordinal suffixes). */
export function formatLegalDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${iso}T00:00:00Z`))
}
