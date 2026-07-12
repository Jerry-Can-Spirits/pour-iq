// At-rest encryption for third-party OAuth tokens stored in D1
// (pouriq_pos_connections, pouriq_accounting_connections). AES-256-GCM via
// WebCrypto; the key is the TOKEN_ENCRYPTION_KEY worker secret (32 bytes,
// base64). Stored format: "enc:v1:<iv b64>:<ciphertext b64>" — values
// without the prefix are passed through on read so any legacy plaintext
// row keeps working and is re-encrypted the next time it is written.
//
// Request contexts resolve the key from getCloudflareContext(); the
// scheduled worker entry has no request context, so it must call
// primeTokenKey(env) before running sweeps.

import { getCloudflareContext } from '@opennextjs/cloudflare'

const PREFIX = 'enc:v1:'

let cachedB64Key: string | null = null
let cachedCryptoKey: CryptoKey | null = null

export function primeTokenKey(env: { TOKEN_ENCRYPTION_KEY?: string }): void {
  if (env.TOKEN_ENCRYPTION_KEY) cachedB64Key = env.TOKEN_ENCRYPTION_KEY
}

function toBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

async function getKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) return cachedCryptoKey
  if (!cachedB64Key) {
    const { env } = getCloudflareContext()
    cachedB64Key = (env as CloudflareEnv).TOKEN_ENCRYPTION_KEY ?? null
  }
  if (!cachedB64Key) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not configured — cannot handle OAuth tokens')
  }
  const raw = toBytes(cachedB64Key)
  if (raw.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must decode to 32 bytes')
  }
  cachedCryptoKey = await crypto.subtle.importKey('raw', raw as unknown as BufferSource, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
  return cachedCryptoKey
}

export async function encryptToken(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await getKey(),
    new TextEncoder().encode(plain),
  )
  return `${PREFIX}${toB64(iv)}:${toB64(new Uint8Array(ct))}`
}

export async function encryptTokenNullable(plain: string | null): Promise<string | null> {
  return plain === null ? null : encryptToken(plain)
}

export async function decryptToken(stored: string): Promise<string> {
  if (!stored.startsWith(PREFIX)) return stored // legacy plaintext passthrough
  const [ivB64, ctB64] = stored.slice(PREFIX.length).split(':')
  if (!ivB64 || !ctB64) throw new Error('Malformed encrypted token')
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toBytes(ivB64) as BufferSource },
    await getKey(),
    toBytes(ctB64) as BufferSource,
  )
  return new TextDecoder().decode(plain)
}

export async function decryptTokenNullable(stored: string | null): Promise<string | null> {
  return stored === null ? null : decryptToken(stored)
}
