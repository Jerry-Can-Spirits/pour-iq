import { cookies } from 'next/headers'
import { DEMO_SESSION_COOKIE, DEMO_SESSION_TTL_SECONDS } from './config'

// Anonymous demo sessions: an opaque id in KV with a short TTL. No PIN,
// no account, no venue stored — the venue is the DEMO_VENUE_ACCOUNT_ID
// constant, resolved server-side, so a session can never point
// elsewhere.

interface DemoSessionData {
  createdAt: string
}

function demoSessionKey(sid: string): string {
  return `demo:session:${sid}`
}

export async function createDemoSession(kv: KVNamespace): Promise<string> {
  const sid = crypto.randomUUID()
  const data: DemoSessionData = { createdAt: new Date().toISOString() }
  await kv.put(demoSessionKey(sid), JSON.stringify(data), {
    expirationTtl: DEMO_SESSION_TTL_SECONDS,
  })
  return sid
}

export async function readDemoSession(kv: KVNamespace, sid: string): Promise<DemoSessionData | null> {
  const raw = await kv.get(demoSessionKey(sid))
  if (!raw) return null
  try {
    return JSON.parse(raw) as DemoSessionData
  } catch {
    return null
  }
}

export async function revokeDemoSession(kv: KVNamespace, sid: string): Promise<void> {
  await kv.delete(demoSessionKey(sid))
}

export async function setDemoSessionCookie(sid: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(DEMO_SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: DEMO_SESSION_TTL_SECONDS,
  })
}

export async function clearDemoSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(DEMO_SESSION_COOKIE)
}

export async function getDemoSessionCookieValue(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(DEMO_SESSION_COOKIE)?.value ?? null
}
