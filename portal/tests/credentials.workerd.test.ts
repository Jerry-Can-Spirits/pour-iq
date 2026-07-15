import { describe, it, expect } from 'vitest'
import {
  hashPin,
  verifyPin,
  isHashedPin,
  pinLookupKey,
  pinRateKey,
  PBKDF2_ITERATIONS,
} from '../src/lib/trade-portal/credentials'

// This suite runs on workerd (see vitest.config.ts), so WebCrypto here
// behaves exactly as it does in production — including the 100k PBKDF2
// iteration cap that Node does not enforce.

const PEPPER = 'test-pepper-value-32-bytes-long!'

describe('mint-and-verify on the real runtime', () => {
  it('never exceeds the production PBKDF2 cap', () => {
    // Verified against local workerd 2026-07-15: the simulator happily
    // runs 600k iterations, but production Workers rejects anything
    // above 100k ("NotSupportedError: Pbkdf2 failed: iteration counts
    // above 100000 are not supported" — observed live). The limit is
    // enforced in Cloudflare's production layer, not in the bundled
    // workerd, so this explicit pin is the regression guard: raising
    // the constant fails CI here until production provably supports it.
    expect(PBKDF2_ITERATIONS).toBeLessThanOrEqual(100_000)
  })

  it('round-trips a PIN at the configured iteration count', async () => {
    const stored = await hashPin(PEPPER, '123456')
    expect(isHashedPin(stored)).toBe(true)
    expect(stored.split(':')[2]).toBe(String(PBKDF2_ITERATIONS))
    expect(await verifyPin(PEPPER, '123456', stored)).toBe(true)
  })

  it('rejects the wrong PIN and the wrong pepper', async () => {
    const stored = await hashPin(PEPPER, '123456')
    expect(await verifyPin(PEPPER, '123457', stored)).toBe(false)
    expect(await verifyPin('another-pepper', '123456', stored)).toBe(false)
  })

  it('fails closed on iteration counts above the production cap', async () => {
    // A row minted at 600k (the value that shipped and 500ed in
    // production) must verify as false — never throw. On production
    // workerd the underlying deriveBits throws and verifySecret
    // catches it; on local workerd it computes and mismatches. Both
    // paths must land on false.
    const overCap = 'pin:v1:600000:AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
    await expect(verifyPin(PEPPER, '123456', overCap)).resolves.toBe(false)
  })

  it('fails closed on malformed and legacy plaintext values', async () => {
    expect(await verifyPin(PEPPER, '123456', '123456')).toBe(false)
    expect(await verifyPin(PEPPER, '123456', 'pin:v1:garbage')).toBe(false)
    expect(await verifyPin(PEPPER, '123456', 'pin:v1:100000:not-base64!!:also-not!!')).toBe(false)
    expect(isHashedPin('123456')).toBe(false)
    expect(isHashedPin('purged-abc')).toBe(false)
  })

  it('derives deterministic, domain-separated lookup keys', async () => {
    const base = await pinLookupKey(PEPPER, '123456')
    expect(await pinLookupKey(PEPPER, '123456')).toEqual(base)
    expect(await pinLookupKey(PEPPER, '654321')).not.toEqual(base)
    expect(await pinLookupKey('another-pepper', '123456')).not.toEqual(base)
    const stored = await hashPin(PEPPER, '123456')
    expect(stored).not.toContain(base)
  })

  it('keeps raw PINs out of rate-limit keys', async () => {
    const key = await pinRateKey('123456')
    expect(key).toMatch(/^[0-9a-f]{64}$/)
    expect(key).not.toContain('123456')
  })
})
