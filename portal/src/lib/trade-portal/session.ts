import { cookies } from 'next/headers'

export const TRADE_SESSION_COOKIE = 'jcs_trade_sid'

interface SessionData {
  tradeAccountId: string
  createdAt: string
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

function sessionKey(sid: string): string {
  return `trade:session:${sid}`
}

export async function createTradeSession(
  kv: KVNamespace,
  tradeAccountId: string,
): Promise<string> {
  const sid = crypto.randomUUID()
  const data: SessionData = {
    tradeAccountId,
    createdAt: new Date().toISOString(),
  }
  await kv.put(sessionKey(sid), JSON.stringify(data), {
    expirationTtl: SESSION_TTL_SECONDS,
  })
  return sid
}

export async function readTradeSession(kv: KVNamespace, sid: string): Promise<SessionData | null> {
  const raw = await kv.get(sessionKey(sid))
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionData
  } catch {
    return null
  }
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
    maxAge: SESSION_TTL_SECONDS,
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
