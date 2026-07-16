import { cookies } from 'next/headers'
import { DEMO_SESSION_TTL_SECONDS } from './config'

// Per-session write overlay — the only place a demo session's "writes"
// land, never D1. Carried in an httpOnly cookie rather than KV.
//
// Why a cookie and not KV: the demo reads its overlay on every page
// render, often before the first write, which negative-caches the KV
// key; Cloudflare KV then does not make the subsequent write visible in
// that edge location for up to 60s, so price toggles and the applied
// ripple would not show on reload (a prod-only effect miniflare hid).
// A cookie is read-your-writes instant, still per-session, still off
// D1, and still vanishes on reset (cleared) and on expiry (maxAge). It
// is httpOnly and tiny (a few overrides); the endpoints validate every
// write server-side, so the cookie only ever carries bounded, checked
// values.

export const DEMO_OVERLAY_COOKIE = 'pouriq_demo_overlay'

export interface DemoOverlay {
  // Sale-price overrides from the price toggle, cocktail id -> pence.
  priceOverrides?: Record<string, number>
  // Whether the scan-ripple has been applied this session.
  rippleApplied?: boolean
}

export async function readDemoOverlay(): Promise<DemoOverlay> {
  const raw = (await cookies()).get(DEMO_OVERLAY_COOKIE)?.value
  if (!raw) return {}
  // The value is JSON that Next URL-encodes on write. Depending on the
  // runtime, the incoming value may arrive decoded or still encoded, so
  // try both — parse as-is first, then URL-decoded.
  for (const candidate of [raw, tryDecode(raw)]) {
    if (candidate === null) continue
    try {
      const parsed = JSON.parse(candidate) as DemoOverlay
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      /* try the next candidate */
    }
  }
  return {}
}

function tryDecode(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

// Cookie attributes for writing the overlay on an API response.
export function demoOverlayCookie(overlay: DemoOverlay) {
  return {
    name: DEMO_OVERLAY_COOKIE,
    value: JSON.stringify(overlay),
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: DEMO_SESSION_TTL_SECONDS,
  }
}

export function withPriceOverride(
  overlay: DemoOverlay,
  cocktailId: string,
  salePriceP: number,
): DemoOverlay {
  return {
    ...overlay,
    priceOverrides: { ...(overlay.priceOverrides ?? {}), [cocktailId]: salePriceP },
  }
}

export function withRippleApplied(overlay: DemoOverlay): DemoOverlay {
  return { ...overlay, rippleApplied: true }
}
