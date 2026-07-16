// Public read-mostly demo of The Signal Box. Central config so the
// venue binding, TTLs, and the default-deny authorisation lists live in
// one auditable place.
//
// Security model (enforced in middleware + the demo endpoints):
//   - Demo sessions resolve ONLY to DEMO_VENUE_ACCOUNT_ID, never any
//     other venue (the id is a constant here, not derived from the
//     session, so it cannot be redirected).
//   - Writes are default-deny: every mutating request is blocked for a
//     demo session except the explicit DEMO_WRITE_ALLOWLIST, and those
//     write to a per-session KV overlay, never D1.
//   - Dangerous surfaces (settings, integrations, upload, AI extraction,
//     export, account) are blocked outright regardless of method.

// The Signal Box (account "Demo Venue") in production pour-iq-db. A
// constant, so a demo session can never resolve to another venue.
export const DEMO_VENUE_ACCOUNT_ID = 'f7123ef643814d292ab9202832efa2fc'

export const DEMO_SESSION_COOKIE = 'pouriq_demo_sid'
export const DEMO_SESSION_TTL_SECONDS = 30 * 60 // 30 minutes
export const DEMO_MINT_RATE_LIMIT = 10 // demo sessions per hour per IP

// The ONLY paths a demo session may POST to. Everything else that
// mutates is default-denied. The two overlay endpoints write to KV, not
// D1; the reset endpoint clears the overlay.
export const DEMO_WRITE_ALLOWLIST: readonly string[] = [
  '/api/pouriq/demo/ripple',
  '/api/pouriq/demo/price',
  '/api/demo/reset',
]

// Blocked for a demo session regardless of HTTP method (defence in
// depth over the method-based write deny). Prefix match.
export const DEMO_BLOCKED_PREFIXES: readonly string[] = [
  '/settings',
  '/api/pouriq/integrations',
  '/api/pouriq/export',
  '/api/pouriq/import',
  '/api/pouriq/invoices/upload',
  '/api/pouriq/invoices/extract',
  '/api/pouriq/invoices/commit',
  '/api/pouriq/recommend',
  '/api/pouriq/images',
  '/api/pouriq/cocktails', // description generate (AI) lives under here
  '/api/login',
  '/api/logout',
]

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Default-deny decision for a demo session. Blocked when: the path hits
// a blocked prefix, OR the request mutates and is not on the write
// allowlist. A new mutating route added later is therefore blocked by
// construction until explicitly allowlisted.
export function isBlockedForDemo(pathname: string, method: string): boolean {
  if (DEMO_BLOCKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return true
  }
  if (MUTATING_METHODS.has(method.toUpperCase())) {
    return !DEMO_WRITE_ALLOWLIST.includes(pathname)
  }
  return false
}

// The scan-fixture ripple change set, encoded from the captured
// extraction at portal/demo-fixtures/signal-box/
// harrier-invoice-hws-10832.extraction.json. Resolved to library ids by
// name at request time (scoped to the demo venue), so the "current"
// side always reflects live base data. No AI, no upload — this stored
// set IS the scan.
export interface DemoRippleChange {
  ingredient_name: string
  pricing_mode: 'bottle' | 'unit'
  new_cost_p: number
}

export const DEMO_RIPPLE_CHANGES: readonly DemoRippleChange[] = [
  { ingredient_name: 'Golden rum', pricing_mode: 'bottle', new_cost_p: 2140 },
  { ingredient_name: 'Ginger beer (serve)', pricing_mode: 'unit', new_cost_p: 88 },
]

// The full scanned invoice, mirrored from the same captured extraction as
// DEMO_RIPPLE_CHANGES (harrier-invoice-hws-10832.extraction.json). The
// runtime can't read the fixture file, so the line list lives here as a
// constant, exactly as the change set does. Names match library entries so
// each line resolves to a current cost at request time; only the lines that
// also appear in DEMO_RIPPLE_CHANGES carry a new price — the rest are shown
// at their current cost with no change. This is display data for the scan
// review; the ripple itself is still driven by DEMO_RIPPLE_CHANGES.
export const DEMO_SCAN_SUPPLIER = 'Harrier Wines & Spirits Ltd'
export const DEMO_SCAN_INVOICE_NUMBER = 'HWS-10832'
export const DEMO_SCAN_INVOICE_DATE = '2026-07-14'

export interface DemoScanLine {
  ingredient_name: string
  quantity: number
}

export const DEMO_SCAN_LINES: readonly DemoScanLine[] = [
  { ingredient_name: 'House vodka', quantity: 6 },
  { ingredient_name: 'House gin', quantity: 4 },
  { ingredient_name: 'Premium gin', quantity: 2 },
  { ingredient_name: 'Golden rum', quantity: 2 },
  { ingredient_name: 'Dark rum', quantity: 2 },
  { ingredient_name: 'Expedition Spiced Rum', quantity: 2 },
  { ingredient_name: 'Bourbon', quantity: 2 },
  { ingredient_name: 'Tequila', quantity: 2 },
  { ingredient_name: 'Coffee liqueur', quantity: 2 },
  { ingredient_name: 'Aperol', quantity: 2 },
  { ingredient_name: 'Prosecco', quantity: 12 },
  { ingredient_name: 'Ginger beer (serve)', quantity: 96 },
]
