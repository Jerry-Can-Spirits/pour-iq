import { DEMO_SESSION_TTL_SECONDS } from './config'

// Per-session write overlay. The only place a demo session's "writes"
// land — never D1. Keyed by session id, TTL matched to the session, so
// it vanishes on expiry; the reset endpoint deletes it explicitly.

export interface DemoOverlay {
  // Sale-price overrides from the price toggle, cocktail id -> pence.
  priceOverrides?: Record<string, number>
  // Whether the scan-ripple has been applied this session.
  rippleApplied?: boolean
}

function overlayKey(sid: string): string {
  return `demo:overlay:${sid}`
}

export async function readDemoOverlay(kv: KVNamespace, sid: string): Promise<DemoOverlay> {
  const raw = await kv.get(overlayKey(sid))
  if (!raw) return {}
  try {
    return JSON.parse(raw) as DemoOverlay
  } catch {
    return {}
  }
}

export async function writeDemoOverlay(kv: KVNamespace, sid: string, overlay: DemoOverlay): Promise<void> {
  await kv.put(overlayKey(sid), JSON.stringify(overlay), {
    expirationTtl: DEMO_SESSION_TTL_SECONDS,
  })
}

export async function clearDemoOverlay(kv: KVNamespace, sid: string): Promise<void> {
  await kv.delete(overlayKey(sid))
}

// Merge a single price override into the overlay and persist.
export async function setDemoPriceOverride(
  kv: KVNamespace,
  sid: string,
  cocktailId: string,
  salePriceP: number,
): Promise<DemoOverlay> {
  const overlay = await readDemoOverlay(kv, sid)
  const priceOverrides = { ...(overlay.priceOverrides ?? {}), [cocktailId]: salePriceP }
  const next: DemoOverlay = { ...overlay, priceOverrides }
  await writeDemoOverlay(kv, sid, next)
  return next
}

export async function setDemoRippleApplied(kv: KVNamespace, sid: string): Promise<DemoOverlay> {
  const overlay = await readDemoOverlay(kv, sid)
  const next: DemoOverlay = { ...overlay, rippleApplied: true }
  await writeDemoOverlay(kv, sid, next)
  return next
}
