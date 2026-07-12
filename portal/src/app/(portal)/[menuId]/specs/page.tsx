import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { getMenu, listCocktailsForMenu } from '@/lib/pouriq/menus'
import { SpecCardsView } from '@/components/pouriq/SpecCardsView'
import { calculateMenuMetrics } from '@/lib/pouriq/calculations'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ menuId: string }>
}

export default async function SpecCardsPage({ params }: Props) {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { menuId } = await params
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database

  const menu = await getMenu(db, menuId, access.tradeAccountId)
  if (!menu) notFound()

  const cocktails = await listCocktailsForMenu(db, menuId)
  const priceIncludesVat = menu.prices_include_vat === 1
  const metrics = calculateMenuMetrics(cocktails, priceIncludesVat, [])
  const costById: Record<string, { pourCostP: number; gpPct: number; complete: boolean }> = {}
  for (const m of metrics.cocktail_metrics) {
    costById[m.cocktail_id] = { pourCostP: m.pour_cost_p, gpPct: m.gp_pct, complete: m.cost_complete }
  }

  const reportDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <main className="min-h-screen print-region">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <div className="no-print">
          <Link
            href={`/${menuId}`}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← {menu.name}
          </Link>
          <div className="inline-block px-4 py-2 bg-slate-100 rounded-full border border-slate-200 mt-3 mb-6">
            <span className="text-slate-500 text-sm font-semibold uppercase tracking-widest">
              Pour IQ™
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
            Spec cards
          </h1>
          <p className="text-slate-600 text-base leading-relaxed mb-6">
            Every drink on this menu as a training reference. Print one card per page for a booklet, or compact for strips along the bar.
          </p>
        </div>

        <div className="hidden print:block mb-6 pb-4 border-b border-stone-300">
          <p className="text-xs uppercase tracking-widest">Pour IQ™ spec cards</p>
          <p className="text-xs">
            {menu.name} · Generated {reportDate}
          </p>
        </div>

        {cocktails.length === 0 ? (
          <p className="text-slate-600 no-print">
            No drinks on this menu yet.{' '}
            <Link
              href={`/${menuId}`}
              className="text-emerald-700 hover:text-emerald-600 underline"
            >
              Add or import drinks
            </Link>{' '}
            first.
          </p>
        ) : (
          <SpecCardsView cocktails={cocktails} costById={costById} priceIncludesVat={priceIncludesVat} />
        )}
      </div>
    </main>
  )
}
