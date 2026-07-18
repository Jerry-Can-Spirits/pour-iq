import { vi, describe, it, expect, beforeEach } from 'vitest'

// The global failed-login counter is a site-wide lockout on a public portal, so
// its trigger must be EXPENSIVE to reach: it must increment only on a genuine
// verify failure, never on a cheap 400 (malformed body / sub-floor PIN).
// Otherwise an attacker hammering 3-digit PINs could lock out every venue for
// ten minutes at negligible cost. These tests exercise the real route handler.

// Test doubles handed to the route via a mocked getCloudflareContext.
const state: { kv: KVNamespace; dbFirst: unknown } = {
  kv: null as unknown as KVNamespace,
  dbFirst: null,
}

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({
    env: {
      SITE_OPS: state.kv,
      // No PIN_PEPPER, so the route takes the legacy plaintext SELECT; dbFirst
      // controls whether an account "matches".
      DB: {
        prepare: () => ({
          bind: () => ({ first: async () => state.dbFirst, run: async () => ({}) }),
        }),
      },
    },
  }),
}))

vi.mock('@/lib/trade-portal/session', () => ({
  createTradeSession: async () => 'sid',
  setTradeSessionCookie: async () => {},
}))

import { POST } from '@/app/api/login/route'
import { getGlobalFailedAttempts } from '@/lib/kv'

function mockKv(): KVNamespace {
  const store = new Map<string, string>()
  return {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => {
      store.set(k, v)
    },
    delete: async (k: string) => {
      store.delete(k)
    },
  } as unknown as KVNamespace
}

function post(body: unknown) {
  return POST(
    new Request('https://app.pour-iq.co.uk/api/login', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
}

describe('global counter DoS-safety (Pour IQ portal is public-facing)', () => {
  beforeEach(() => {
    state.kv = mockKv()
    state.dbFirst = null
  })

  it('a sub-floor PIN returns 400 and does NOT increment the global counter', async () => {
    const res = await post({ pin: '123' })
    expect(res.status).toBe(400)
    expect(await getGlobalFailedAttempts(state.kv)).toBe(0)
  })

  it('a malformed body returns 400 and does NOT increment the global counter', async () => {
    const res = await post('not json{')
    expect(res.status).toBe(400)
    expect(await getGlobalFailedAttempts(state.kv)).toBe(0)
  })

  it('a well-formed unknown PIN returns 401 and DOES increment the global counter', async () => {
    state.dbFirst = null // no account matches this PIN
    const res = await post({ pin: '999999' })
    expect(res.status).toBe(401)
    expect(await getGlobalFailedAttempts(state.kv)).toBe(1)
  })
})
