import { cookies } from 'next/headers'

export const TRADE_SESSION_COOKIE = 'jcs_trade_sid'

interface SessionData {
  tradeAccountId: string
  createdAt: string
  refreshedAt: string
}

// A session's cookie and absolute server-side lifetime: it cannot be slid past
// this however active. The KV entry itself uses the shorter idle window below
// and is refreshed on activity, so an idle session — a bar tablet left after
// close — expires on its own well before the absolute cap.
const ABSOLUTE_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
const IDLE_TTL_SECONDS = 60 * 60 * 12 // 12 hours of inactivity
// Throttle the sliding-window refresh so an active session writes KV at most
// once per interval rather than on every request.
const REFRESH_THROTTLE_SECONDS = 60 * 5 // 5 minutes

function sessionKey(sid: string): string {
  return `trade:session:${sid}`
}

export async function createTradeSession(
  kv: KVNamespace,
  tradeAccountId: string,
): Promise<string> {
  const sid = crypto.randomUUID()
  const now = new Date().toISOString()
  const data: SessionData = {
    tradeAccountId,
    createdAt: now,
    refreshedAt: now,
  }
  await kv.put(sessionKey(sid), JSON.stringify(data), {
    expirationTtl: IDLE_TTL_SECONDS,
  })
  return sid
}

export async function readTradeSession(kv: KVNamespace, sid: string): Promise<SessionData | null> {
  const raw = await kv.get(sessionKey(sid))
  if (!raw) return null
  let data: SessionData
  try {
    data = JSON.parse(raw) as SessionData
  } catch {
    return null
  }
  const now = Date.now()
  // Absolute lifetime cap: a session cannot be slid past this, however active.
  if (now - Date.parse(data.createdAt) > ABSOLUTE_TTL_SECONDS * 1000) {
    await kv.delete(sessionKey(sid))
    return null
  }
  // Sliding idle window: refresh the KV TTL on activity so an idle session
  // expires on its own after IDLE_TTL. Throttled to avoid a write per request.
  const refreshedAt = Date.parse(data.refreshedAt ?? data.createdAt)
  if (now - refreshedAt >= REFRESH_THROTTLE_SECONDS * 1000) {
    data.refreshedAt = new Date(now).toISOString()
    await kv.put(sessionKey(sid), JSON.stringify(data), { expirationTtl: IDLE_TTL_SECONDS })
  }
  return data
}

export async function revokeTradeSession(kv: KVNamespace, sid: string): Promise<void> {
  await kv.delete(sessionKey(sid))
}

export async function setTradeSessionCookie(sid: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(TRADE_SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ABSOLUTE_TTL_SECONDS,
  })
}

export async function clearTradeSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(TRADE_SESSION_COOKIE)
}

export async function getTradeSessionCookieValue(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(TRADE_SESSION_COOKIE)?.value ?? null
}
