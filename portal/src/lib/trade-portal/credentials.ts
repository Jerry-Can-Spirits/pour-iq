// Peppered PIN hashing for trade-account credentials.
//
// Threat model: a PIN is a low-entropy secret (4–32 characters), so a
// database dump alone must never be enough to recover it — any offline
// guess must require PIN_PEPPER, a Wrangler secret that never touches
// the database. Every stored value is keyed through HMAC-SHA-256 with
// the pepper before PBKDF2 stretching; without the pepper, offline
// guessing is impossible, and with it each guess still costs a full
// PBKDF2 run.
//
// Two values per account:
//   pin         — 'pin:v1:<iterations>:<salt b64>:<hash b64>', random
//                 salt, written by the hourly sweep or the login
//                 upgrade path.
//   pin_lookup  — deterministic hex HMAC of the PIN, unique-indexed,
//                 so login can SELECT by credential (a salted hash
//                 cannot be queried). Equal PINs collide here by
//                 design; the schema already requires PINs unique.
//
// The 'pin:v1' prefix is versioned. 'pw:v1' is reserved for the
// planned owner username/password credentials, which will reuse
// hashSecret()/verifySecret() unchanged — only the prefix differs.
//
// This file is the reference implementation for credential hashing
// across the Jerry Can Spirits Ltd repos (see docs/SECURITY.md); the
// pour-iq portal carries a byte-identical copy.

const PIN_PREFIX = 'pin:v1'
export const PBKDF2_ITERATIONS = 600_000

const encoder = new TextEncoder()

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0))
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256(key: string, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message))
  return new Uint8Array(sig)
}

async function stretch(
  pepper: string,
  secret: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  // Domain-separated pepper pass first, then the slow stretch, so the
  // PBKDF2 input already depends on the out-of-database secret.
  const material = await hmacSha256(pepper, `hash:${secret}`)
  const baseKey = await crypto.subtle.importKey('raw', material as BufferSource, 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    baseKey,
    256,
  )
  return new Uint8Array(bits)
}

async function hashSecret(pepper: string, secret: string, prefix: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await stretch(pepper, secret, salt, PBKDF2_ITERATIONS)
  return `${prefix}:${PBKDF2_ITERATIONS}:${toBase64(salt)}:${toBase64(hash)}`
}

async function verifySecret(
  pepper: string,
  secret: string,
  stored: string,
  prefix: string,
): Promise<boolean> {
  const parts = stored.split(':')
  // ['pin', 'v1', iterations, salt, hash]
  if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== prefix) return false
  const iterations = Number(parts[2])
  if (!Number.isInteger(iterations) || iterations < 1) return false
  const salt = fromBase64(parts[3])
  const expected = fromBase64(parts[4])
  const actual = await stretch(pepper, secret, salt, iterations)
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
  return diff === 0
}

export function isHashedPin(stored: string): boolean {
  return stored.startsWith(`${PIN_PREFIX}:`)
}

export async function hashPin(pepper: string, pin: string): Promise<string> {
  return hashSecret(pepper, pin, PIN_PREFIX)
}

export async function verifyPin(pepper: string, pin: string, stored: string): Promise<boolean> {
  return verifySecret(pepper, pin, stored, PIN_PREFIX)
}

// Deterministic login-lookup key. Domain-separated from the hash pass.
export async function pinLookupKey(pepper: string, pin: string): Promise<string> {
  return toHex(await hmacSha256(pepper, `lookup:${pin}`))
}

// Pepper-free identifier for rate-limit KV keys, so raw PINs never
// appear in KV key names. Not stored durably; plain SHA-256 suffices.
export async function pinRateKey(pin: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(pin))
  return toHex(new Uint8Array(digest))
}
