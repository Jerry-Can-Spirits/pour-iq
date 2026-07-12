// POST /api/pouriq/import/upload
// multipart/form-data with a single `file` field (PDF only).
// Returns { ticket, filename }.

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isAllowedOrigin, isRateLimited } from '@/lib/kv'
import { checkPourIqAccess } from '@/lib/pouriq/access'

export const runtime = 'nodejs'

const MAX_BYTES = 5 * 1024 * 1024 // 5MB
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46] // %PDF
const UPLOAD_RATE_LIMIT = 30 // per hour per IP

function startsWithBytes(buf: Uint8Array, prefix: number[]): boolean {
  if (buf.length < prefix.length) return false
  for (let i = 0; i < prefix.length; i++) if (buf[i] !== prefix[i]) return false
  return true
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace
  const r2 = env.TRADE_DOCS as R2Bucket

  const ip = (request.headers.get('CF-Connecting-IP') ?? request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()
  if (await isRateLimited(kv, 'pouriq-import-upload', ip, UPLOAD_RATE_LIMIT, 3600)) {
    return NextResponse.json({ error: 'Too many uploads. Please try again later.' }, { status: 429 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Empty file' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 5MB limit' }, { status: 400 })
  }

  const buffer = new Uint8Array(await file.arrayBuffer())
  if (!startsWithBytes(buffer, PDF_MAGIC)) {
    return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
  }

  const ticket = crypto.randomUUID()
  const key = `pouriq-imports/${ticket}`
  await r2.put(key, buffer, {
    httpMetadata: { contentType: 'application/pdf' },
    customMetadata: {
      originalName: file.name || 'menu.pdf',
      ts: new Date().toISOString(),
      tradeAccountId: access.tradeAccountId,
    },
  })

  return NextResponse.json({ ticket, filename: file.name || 'menu.pdf' })
}
