import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ ticket: string }> }) {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') return new Response('Unauthorized', { status: 401 })
  if (access.kind === 'no-licence') return new Response('Forbidden', { status: 403 })
  const { ticket } = await params
  // Tickets are minted as crypto.randomUUID() at upload. Enforce that contract
  // at the boundary before the value reaches the R2 key.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticket)) {
    return new Response('Bad Request', { status: 400 })
  }
  const { env } = await getCloudflareContext()
  const r2 = env.TRADE_DOCS as R2Bucket
  const obj = await r2.get(`pouriq-invoices/_pending/${ticket}.pdf`)
  if (!obj) return new Response('Not found', { status: 404 })
  // Defense-in-depth: verify the uploader tenant matches the requester.
  // Tickets are crypto.randomUUID() so guessing is infeasible, but a leaked
  // ticket must not let another tenant stream someone else's invoice PDF.
  if (obj.customMetadata?.tradeAccountId !== access.tradeAccountId) {
    return new Response('Not found', { status: 404 })
  }
  return new Response(obj.body, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': 'inline; filename="invoice.pdf"',
      'cache-control': 'private, no-store',
    },
  })
}
