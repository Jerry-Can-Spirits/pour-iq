import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { PourIqShell } from '@/components/pouriq/PourIqShell'

// The authenticated trade app should never be indexed (matches the sibling
// trade layouts: apply / landing / login).
export const metadata = { robots: { index: false, follow: false } }

export default async function PourIqLayout({ children }: { children: ReactNode }) {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const row = await db
    .prepare(`SELECT venue_name FROM trade_accounts WHERE id = ?1`)
    .bind(access.tradeAccountId)
    .first<{ venue_name: string | null }>()
  const venueName = row?.venue_name?.trim() ?? ''
  const demo = access.kind === 'ok' && access.role === 'demo'

  return (
    <PourIqShell venueName={venueName} demo={demo}>
      {children}
    </PourIqShell>
  )
}
