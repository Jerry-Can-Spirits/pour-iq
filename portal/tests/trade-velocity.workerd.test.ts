import { describe, expect, it } from 'vitest'
import {
  getTradeFailedAttempts,
  incrementTradeFailedAttempts,
  clearTradeFailedAttempts,
  TRADE_MAX_ATTEMPTS,
  getTradeFailedAttemptsForPin,
  incrementTradeFailedAttemptsForPin,
  TRADE_PIN_MAX_ATTEMPTS,
  getGlobalFailedAttempts,
  incrementGlobalFailedAttempts,
  TRADE_GLOBAL_MAX_ATTEMPTS,
} from '../src/lib/kv'

// Minimal in-memory KVNamespace. TTL is irrelevant to the counter logic under
// test (a tripped counter clears via TTL in production; here we assert values).
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

describe('global failed-login velocity (distributed enumeration bound)', () => {
  it('bounds enumeration that the per-IP and per-PIN counters both miss', async () => {
    const kv = mockKv()
    // Every guess from a fresh IP and a fresh PIN — the shape that defeats the
    // per-IP and per-PIN counters.
    for (let i = 0; i < TRADE_GLOBAL_MAX_ATTEMPTS; i++) {
      await incrementTradeFailedAttempts(kv, `10.0.0.${i}`)
      await incrementTradeFailedAttemptsForPin(kv, `guess-${i}`)
      await incrementGlobalFailedAttempts(kv)
    }

    // Each per-IP and per-PIN counter saw exactly one failure — neither trips.
    expect(await getTradeFailedAttempts(kv, '10.0.0.0')).toBe(1)
    expect(await getTradeFailedAttemptsForPin(kv, 'guess-0')).toBe(1)
    expect(1).toBeLessThan(TRADE_MAX_ATTEMPTS)
    expect(1).toBeLessThan(TRADE_PIN_MAX_ATTEMPTS)

    // The global counter reached its ceiling: the login route refuses further
    // attempts once getGlobalFailedAttempts >= the ceiling.
    expect(await getGlobalFailedAttempts(kv)).toBeGreaterThanOrEqual(TRADE_GLOBAL_MAX_ATTEMPTS)
  })
})

describe('per-IP ceiling (venue-safe — shared wifi)', () => {
  it('does not lock out a venue after legitimate mistypes below the ceiling', async () => {
    const kv = mockKv()
    const venueIp = '203.0.113.7' // one bar behind a single NAT'd wifi IP

    for (let i = 0; i < TRADE_MAX_ATTEMPTS - 1; i++) {
      await incrementTradeFailedAttempts(kv, venueIp)
    }

    expect(await getTradeFailedAttempts(kv, venueIp)).toBeLessThan(TRADE_MAX_ATTEMPTS)

    // A successful login clears the counter, leaving no lingering penalty.
    await clearTradeFailedAttempts(kv, venueIp)
    expect(await getTradeFailedAttempts(kv, venueIp)).toBe(0)
  })
})
