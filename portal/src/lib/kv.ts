/**
 * Typed KV utilities for the SITE_OPS namespace.
 *
 * Key patterns:
 *   feature:{name}          — Feature flags (JSON, no expiry)
 *   ageverified:{fp}        — Server-side age verification cache (365d TTL)
 *   visitor:{fp}            — First-time vs returning visitor (30d TTL)
 *   trade:failed:{ip}       — Trade PIN failed attempts per IP (15min TTL)
 *   trade:pin-failed:{pinKey} — Trade PIN per-credential failed attempts, keyed by pinRateKey hash (1h TTL)
 *   trade:global-failed     — Global trade-login failed-attempt velocity (10min TTL)
 *   trade:session:{sid}     — Trade portal session tokens (30d TTL)
 *   ratelimit:{prefix}:{ip} — Generic rate limit counters (configurable TTL)
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';

// ── Types ───────────────────────────────────────────────────────────

export interface FeatureFlag {
  enabled: boolean;
  /** Optional metadata (e.g. variant, rollout percentage) */
  [key: string]: unknown;
}

export interface VisitorRecord {
  firstSeen: string;
  visitCount: number;
  lastVisit: string;
}

// ── KV Access ───────────────────────────────────────────────────────

export async function getSiteOpsKV(): Promise<KVNamespace> {
  const { env } = await getCloudflareContext();
  return env.SITE_OPS;
}

// ── Feature Flags ───────────────────────────────────────────────────

export async function getFeatureFlag(
  kv: KVNamespace,
  name: string,
): Promise<FeatureFlag | null> {
  return kv.get<FeatureFlag>(`feature:${name}`, 'json');
}

export async function isFeatureEnabled(
  kv: KVNamespace,
  name: string,
): Promise<boolean> {
  const flag = await getFeatureFlag(kv, name);
  return flag?.enabled ?? false;
}

export async function setFeatureFlag(
  kv: KVNamespace,
  name: string,
  flag: FeatureFlag,
): Promise<void> {
  await kv.put(`feature:${name}`, JSON.stringify(flag));
}

// ── Age Verification Cache ──────────────────────────────────────────

const AGE_VERIFIED_TTL = 60 * 60 * 24 * 365; // 365 days

export async function isAgeVerified(
  kv: KVNamespace,
  fingerprint: string,
): Promise<boolean> {
  const val = await kv.get(`ageverified:${fingerprint}`);
  return val === 'true';
}

export async function setAgeVerified(
  kv: KVNamespace,
  fingerprint: string,
): Promise<void> {
  await kv.put(`ageverified:${fingerprint}`, 'true', {
    expirationTtl: AGE_VERIFIED_TTL,
  });
}

// ── Visitor Tracking ────────────────────────────────────────────────

const VISITOR_TTL = 60 * 60 * 24 * 30; // 30 days

export async function getVisitor(
  kv: KVNamespace,
  fingerprint: string,
): Promise<VisitorRecord | null> {
  return kv.get<VisitorRecord>(`visitor:${fingerprint}`, 'json');
}

export async function trackVisitor(
  kv: KVNamespace,
  fingerprint: string,
): Promise<VisitorRecord> {
  const existing = await getVisitor(kv, fingerprint);
  const now = new Date().toISOString();

  const record: VisitorRecord = existing
    ? { ...existing, visitCount: existing.visitCount + 1, lastVisit: now }
    : { firstSeen: now, visitCount: 1, lastVisit: now };

  await kv.put(`visitor:${fingerprint}`, JSON.stringify(record), {
    expirationTtl: VISITOR_TTL,
  });

  return record;
}

// ── Trade PIN Rate Limiting ─────────────────────────────────────────

// Per-IP failure ceiling — a coarse anti-spray backstop, counted on genuine
// failures only. Set well above a busy shared-IP venue's normal mistypes so it
// never self-DoSes a NAT'd bar; the per-PIN counter below is the real
// per-account brute-force control.
export const TRADE_MAX_ATTEMPTS = 20;
const TRADE_LOCKOUT_TTL = 15 * 60; // 15 minutes

export async function getTradeFailedAttempts(
  kv: KVNamespace,
  ip: string,
): Promise<number> {
  const val = await kv.get(`trade:failed:${ip}`);
  return val ? parseInt(val, 10) : 0;
}

export async function incrementTradeFailedAttempts(
  kv: KVNamespace,
  ip: string,
): Promise<number> {
  const current = await getTradeFailedAttempts(kv, ip);
  const next = current + 1;
  await kv.put(`trade:failed:${ip}`, String(next), {
    expirationTtl: TRADE_LOCKOUT_TTL,
  });
  return next;
}

export async function clearTradeFailedAttempts(
  kv: KVNamespace,
  ip: string,
): Promise<void> {
  await kv.delete(`trade:failed:${ip}`);
}

// ── Trade PIN per-credential lockout ─────────────────────────────────
// Keyed on a hash of the SUBMITTED PIN (pinRateKey), so it bounds repeated
// guesses of one PIN value. Because PINs are schema-unique this is, in effect,
// per-account for an attacker hammering a known credential — but it does NOT
// bound enumeration: an attacker guessing many different PINs hits a fresh key
// on every guess and never trips this. The global velocity counter below is
// the control that bounds distributed enumeration of the PIN space.

export const TRADE_PIN_MAX_ATTEMPTS = 10;
const TRADE_PIN_LOCKOUT_TTL = 60 * 60; // 1 hour

// Callers pass pinRateKey(pin) — a hash — so raw PINs never appear in
// KV key names.
export async function getTradeFailedAttemptsForPin(
  kv: KVNamespace,
  pinKey: string,
): Promise<number> {
  const val = await kv.get(`trade:pin-failed:${pinKey}`);
  return val ? parseInt(val, 10) : 0;
}

export async function incrementTradeFailedAttemptsForPin(
  kv: KVNamespace,
  pinKey: string,
): Promise<number> {
  const current = await getTradeFailedAttemptsForPin(kv, pinKey);
  const next = current + 1;
  await kv.put(`trade:pin-failed:${pinKey}`, String(next), {
    expirationTtl: TRADE_PIN_LOCKOUT_TTL,
  });
  return next;
}

export async function clearTradeFailedAttemptsForPin(
  kv: KVNamespace,
  pinKey: string,
): Promise<void> {
  await kv.delete(`trade:pin-failed:${pinKey}`);
}

// ── Global failed-login velocity ─────────────────────────────────────
// One counter across ALL IPs and PINs, incremented on every genuine login
// failure. This is the primary control against DISTRIBUTED enumeration of the
// PIN space: the per-IP and per-PIN counters are both defeated by spreading
// guesses across IPs (shared or rotating wifi) and across PIN values, but
// every wrong guess, wherever it comes from, increments this single counter.
//
// The ceiling is the delicate parameter — revisit it as the portal grows:
//   - Well ABOVE legitimate failure volume: at pilot scale a handful of venues
//     produce at most low-tens of genuine mistypes in ten minutes, so 100
//     leaves comfortable headroom and a busy Friday rush never trips a
//     site-wide lockout (which would be worse than the attack it prevents).
//   - Well BELOW useful enumeration speed: 100 per 10 minutes caps a
//     distributed attacker at ~600 guesses/hour globally, a severe throttle
//     against a six-digit (10^6) space on top of the per-IP and per-PIN caps.
// It self-heals: the window is fixed, so a tripped counter blocks logins for at
// most TRADE_GLOBAL_WINDOW before clearing (blocked attempts return before the
// increment, so they never extend the lockout). It is never cleared on a
// success — one venue logging in must not reset the global enumeration bound.
// A tripped counter blocking all logins is a deliberate backstop; Turnstile
// after N failures (a consciously deferred follow-up, see docs/SECURITY.md) is
// the intended graduated replacement. Raise this as the live venue count grows.
export const TRADE_GLOBAL_MAX_ATTEMPTS = 100;
const TRADE_GLOBAL_WINDOW = 10 * 60; // 10 minutes

export async function getGlobalFailedAttempts(kv: KVNamespace): Promise<number> {
  const val = await kv.get('trade:global-failed');
  return val ? parseInt(val, 10) : 0;
}

export async function incrementGlobalFailedAttempts(kv: KVNamespace): Promise<number> {
  const current = await getGlobalFailedAttempts(kv);
  const next = current + 1;
  await kv.put('trade:global-failed', String(next), { expirationTtl: TRADE_GLOBAL_WINDOW });
  return next;
}

// ── Origin Validation ───────────────────────────────────────────────

/**
 * Returns false if the request has an Origin header for a different host
 * than the one being served — blocking cross-origin form POSTs while
 * allowing server-to-server calls (which don't send Origin). Compared
 * against the request's own Host rather than a hardcoded domain: the
 * hardcoded constant silently 403ed every portal POST for two days
 * after the Phase 2 domain move, and it also blocked local Workers
 * previews. Same-host comparison is the actual CSRF intent.
 */
export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

// ── Generic Rate Limiting ────────────────────────────────────────────

/**
 * Checks whether an IP has exceeded the rate limit for a given prefix,
 * and increments the counter if not. Returns true if the request should
 * be rejected. Uses a fixed window (counter resets after windowSeconds).
 */
export async function isRateLimited(
  kv: KVNamespace,
  prefix: string,
  ip: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
  const key = `ratelimit:${prefix}:${ip}`;
  const val = await kv.get(key);
  const count = val ? parseInt(val, 10) : 0;
  if (count >= maxRequests) return true;
  await kv.put(key, String(count + 1), { expirationTtl: windowSeconds });
  return false;
}

