'use server'

// The demo-request server action. Works identically with and without
// JavaScript: no-JS submissions re-render the page with the returned
// state; the client island renders the same state inline.
//
// Server-side enforcement, independent of any client checks:
// - every field validated (length caps, email format, consent true)
// - input sanitised (trimmed, control characters stripped)
// - no submission forwarded without consent (GDPR)
// - honeypot filled → silent discard (reports success, forwards nothing)
// - 5 submissions per 10 minutes per IP, KV-backed, keyed by a hash of
//   the IP so raw addresses are never stored

import { headers } from 'next/headers'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { forwardDemoRequest } from '@/lib/klaviyo'
import { contactCopy } from '@/lib/contact-copy'

export interface DemoFormValues {
  name: string
  venue: string
  email: string
  phone: string
  message: string
  consent: boolean
}

export interface DemoFormState {
  status: 'idle' | 'success' | 'error' | 'invalid'
  message?: string
  fieldErrors?: Partial<Record<keyof DemoFormValues, string>>
  values?: DemoFormValues
}

const LIMITS = { name: 100, venue: 120, email: 254, phone: 30, message: 2000 } as const
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_SECONDS = 600

// Trim and replace control characters with spaces; newlines survive
// only where the field is multi-line.
function sanitise(raw: FormDataEntryValue | null, keepNewlines = false): string {
  if (typeof raw !== 'string') return ''
  let out = ''
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0
    const isControl = code < 32 || code === 127
    if (!isControl) out += ch
    else if (keepNewlines && ch === '\n') out += ch
    else out += ' '
  }
  return out.trim()
}

async function hashedIpKey(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

// Minimal structural type for the RATE_LIMIT KV binding — the root
// project does not carry the Workers type package.
interface RateLimitKV {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
}

async function isRateLimited(kv: RateLimitKV, ip: string): Promise<boolean> {
  const key = `contact:${await hashedIpKey(ip)}`
  const current = parseInt((await kv.get(key)) ?? '0', 10)
  if (current >= RATE_LIMIT_MAX) return true
  await kv.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS })
  return false
}

export async function submitDemoRequest(
  _prev: DemoFormState,
  formData: FormData,
): Promise<DemoFormState> {
  // Honeypot: real users never see or fill "company". A filled value is
  // a bot — report success, forward nothing.
  if (sanitise(formData.get('company'))) {
    return { status: 'success' }
  }

  const values: DemoFormValues = {
    name: sanitise(formData.get('name')),
    venue: sanitise(formData.get('venue')),
    email: sanitise(formData.get('email')),
    phone: sanitise(formData.get('phone')),
    message: sanitise(formData.get('message'), true),
    consent: formData.get('consent') === 'on',
  }

  const fieldErrors: DemoFormState['fieldErrors'] = {}
  if (!values.name) fieldErrors.name = contactCopy.errors.nameRequired
  else if (values.name.length > LIMITS.name) fieldErrors.name = contactCopy.errors.tooLong
  if (!values.venue) fieldErrors.venue = contactCopy.errors.venueRequired
  else if (values.venue.length > LIMITS.venue) fieldErrors.venue = contactCopy.errors.tooLong
  if (!values.email) fieldErrors.email = contactCopy.errors.emailRequired
  else if (values.email.length > LIMITS.email || !EMAIL_PATTERN.test(values.email))
    fieldErrors.email = contactCopy.errors.emailInvalid
  if (values.phone.length > LIMITS.phone) fieldErrors.phone = contactCopy.errors.tooLong
  if (values.message.length > LIMITS.message) fieldErrors.message = contactCopy.errors.tooLong
  // GDPR: nothing is stored or forwarded without consent, enforced here
  // regardless of client state.
  if (!values.consent) fieldErrors.consent = contactCopy.errors.consentRequired

  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'invalid', fieldErrors, values }
  }

  const { env } = await getCloudflareContext({ async: true })
  const bindings = env as {
    RATE_LIMIT?: RateLimitKV
    KLAVIYO_API_KEY?: string
    KLAVIYO_DEMO_LIST_ID?: string
  }

  const headerList = await headers()
  const ip = (headerList.get('cf-connecting-ip') ?? headerList.get('x-forwarded-for') ?? 'unknown')
    .split(',')[0]
    .trim()
  if (bindings.RATE_LIMIT && (await isRateLimited(bindings.RATE_LIMIT, ip))) {
    return { status: 'error', message: contactCopy.errors.rateLimited, values }
  }

  const result = await forwardDemoRequest(bindings, {
    name: values.name,
    venue: values.venue,
    email: values.email,
    phone: values.phone,
    message: values.message,
    consentedAt: new Date().toISOString(),
  })

  if (result === 'unavailable') {
    return { status: 'error', message: contactCopy.errors.unavailable, values }
  }
  if (result === 'error') {
    return { status: 'error', message: contactCopy.errors.submitFailed, values }
  }
  return { status: 'success' }
}
