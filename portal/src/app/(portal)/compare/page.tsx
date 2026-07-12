import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import {
  getMenu,
  listMenusForTradeAccount,
  listCocktailsForMenu,
} from '@/lib/pouriq/menus'
import { calculateMenuMetrics } from '@/lib/pouriq/calculations'
import { listVolumesForPeriod, currentPeriod } from '@/lib/pouriq/volumes'
import { compareMenus } from '@/lib/pouriq/menu-compare'
import { LicenceGate } from '@/components/pouriq/LicenceGate'

export const dynamic = 'force-dynamic'

interface SearchParams {
  searchParams: Promise<{ a?: string; b?: string }>
}

function fmtMoney(p: number) { return `£${(p / 100).toFixed(2)}` }
function fmtSignedMoney(p: number) {
  const abs = Math.abs(p)
  const sign = p > 0 ? '+' : p < 0 ? '−' : ''
  return `${sign}£${(abs / 100).toFixed(2)}`
}
function fmtSignedPct(n: number) {
  const abs = Math.abs(n)
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}${abs.toFixed(1)}pp`
}

function deltaColor(delta: number, betterWhenPositive = true): string {
  if (delta === 0) return 'text-slate-600'
  const positive = delta > 0
  const good = positive === betterWhenPositive
  return good ? 'text-emerald-600' : 'text-rose-600'
}

export default async function ComparePage({ searchParams }: SearchParams) {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { a: aId, b: bId } = await searchParams
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const menus = await listMenusForTradeAccount(db, access.tradeAccountId)

  let comparison: ReturnType<typeof compareMenus> | null = null
  let aMenu = aId ? await getMenu(db, aId, access.tradeAccountId) : null
  let bMenu = bId ? await getMenu(db, bId, access.tradeAccountId) : null

  if (aMenu && bMenu) {
    const aPeriod = currentPeriod(aMenu.volume_cadence)
    const bPeriod = currentPeriod(bMenu.volume_cadence)
    const [aCocktails, bCocktails, aVolumes, bVolumes] = await Promise.all([
      listCocktailsForMenu(db, aMenu.id),
      listCocktailsForMenu(db, bMenu.id),
      listVolumesForPeriod(db, aMenu.id, aPeriod.start, aPeriod.end),
      listVolumesForPeriod(db, bMenu.id, bPeriod.start, bPeriod.end),
    ])
    const aMetrics = calculateMenuMetrics(aCocktails, aMenu.prices_include_vat === 1, aVolumes)
    const bMetrics = calculateMenuMetrics(bCocktails, bMenu.prices_include_vat === 1, bVolumes)
    comparison = compareMenus(
      { menu: aMenu, cocktails: aCocktails, metrics: aMetrics.cocktail_metrics },
      { menu: bMenu, cocktails: bCocktails, metrics: bMetrics.cocktail_metrics },
    )
  } else {
    aMenu = null
    bMenu = null
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <Link href="/menus" className="text-sm text-slate-500 hover:text-slate-700">← All menus</Link>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mt-3 mb-2">Compare menus</h1>
        <p className="text-slate-500 text-sm mb-10">
          Pick two menus to see what changed: drinks added, drinks removed, and per-drink shifts in GP, margin, and contribution.
        </p>

        <form className="bg-white border border-slate-200 rounded-xl p-6 mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4" method="get">
          <div>
            <label htmlFor="a" className="block text-sm font-medium text-slate-700 mb-2">Baseline (A)</label>
            <select id="a" name="a" defaultValue={aId ?? ''} className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-emerald-500 focus:outline-hidden">
              <option value="">Pick a menu</option>
              {menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="b" className="block text-sm font-medium text-slate-700 mb-2">Compare against (B)</label>
            <select id="b" name="b" defaultValue={bId ?? ''} className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-emerald-500 focus:outline-hidden">
              <option value="">Pick a menu</option>
              {menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" className="inline-flex items-center px-5 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors text-sm">
              Compare
            </button>
          </div>
        </form>

        {aMenu && bMenu && comparison && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Baseline</p>
                <h2 className="text-lg font-bold text-slate-900 mb-3">{aMenu.name}</h2>
                <p className="text-sm text-slate-700">{comparison.a_summary.cocktail_count} drink{comparison.a_summary.cocktail_count === 1 ? '' : 's'} · avg GP {comparison.a_summary.avg_gp_pct.toFixed(1)}%</p>
                <p className="text-sm text-slate-700">Total margin: {fmtMoney(comparison.a_summary.total_margin_p)}</p>
                {comparison.a_summary.total_contribution_p > 0 && (
                  <p className="text-sm text-slate-700">Period contribution: {fmtMoney(comparison.a_summary.total_contribution_p)}</p>
                )}
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Comparison</p>
                <h2 className="text-lg font-bold text-slate-900 mb-3">{bMenu.name}</h2>
                <p className="text-sm text-slate-700">
                  {comparison.b_summary.cocktail_count} drink{comparison.b_summary.cocktail_count === 1 ? '' : 's'} ·
                  {' '}avg GP{' '}
                  <span className={deltaColor(comparison.b_summary.avg_gp_pct - comparison.a_summary.avg_gp_pct)}>
                    {comparison.b_summary.avg_gp_pct.toFixed(1)}% ({fmtSignedPct(comparison.b_summary.avg_gp_pct - comparison.a_summary.avg_gp_pct)})
                  </span>
                </p>
                <p className="text-sm text-slate-700">
                  Total margin:{' '}
                  <span className={deltaColor(comparison.b_summary.total_margin_p - comparison.a_summary.total_margin_p)}>
                    {fmtMoney(comparison.b_summary.total_margin_p)} ({fmtSignedMoney(comparison.b_summary.total_margin_p - comparison.a_summary.total_margin_p)})
                  </span>
                </p>
                {(comparison.a_summary.total_contribution_p > 0 || comparison.b_summary.total_contribution_p > 0) && (
                  <p className="text-sm text-slate-700">
                    Period contribution:{' '}
                    <span className={deltaColor(comparison.b_summary.total_contribution_p - comparison.a_summary.total_contribution_p)}>
                      {fmtMoney(comparison.b_summary.total_contribution_p)} ({fmtSignedMoney(comparison.b_summary.total_contribution_p - comparison.a_summary.total_contribution_p)})
                    </span>
                  </p>
                )}
              </div>
            </div>

            {comparison.shared.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-slate-900 mb-4">Drinks on both menus</h2>
                <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-sm min-w-[760px]">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-slate-500 text-xs uppercase tracking-widest">
                        <th className="px-4 py-3">Drink</th>
                        <th className="px-4 py-3">A · GP</th>
                        <th className="px-4 py-3">B · GP</th>
                        <th className="px-4 py-3">GP change</th>
                        <th className="px-4 py-3">Margin change</th>
                        <th className="px-4 py-3">Contribution change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.shared.map((d) => (
                        <tr key={d.cocktail_name} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-slate-900">{d.cocktail_name}</td>
                          <td className="px-4 py-3 text-slate-700">{fmtMoney(d.a.sale_price_p)} · {d.a.gp_pct.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-slate-700">{fmtMoney(d.b.sale_price_p)} · {d.b.gp_pct.toFixed(1)}%</td>
                          <td className={`px-4 py-3 ${deltaColor(d.delta_gp_pct)}`}>{fmtSignedPct(d.delta_gp_pct)}</td>
                          <td className={`px-4 py-3 ${deltaColor(d.delta_margin_p)}`}>{fmtSignedMoney(d.delta_margin_p)}</td>
                          <td className={`px-4 py-3 ${d.delta_contribution_p === null ? 'text-slate-400' : deltaColor(d.delta_contribution_p)}`}>
                            {d.delta_contribution_p === null ? '—' : fmtSignedMoney(d.delta_contribution_p)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section>
                <h2 className="text-xl font-bold text-slate-900 mb-4">Removed from B</h2>
                {comparison.only_in_a.length === 0 ? (
                  <p className="text-sm text-slate-500">Nothing removed.</p>
                ) : (
                  <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {comparison.only_in_a.map((d) => (
                      <li key={d.cocktail_name} className="px-4 py-3 text-sm">
                        <p className="text-slate-900">{d.cocktail_name}</p>
                        <p className="text-xs text-slate-500">Was {fmtMoney(d.sale_price_p)} · {d.gp_pct.toFixed(1)}% GP</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h2 className="text-xl font-bold text-slate-900 mb-4">Added in B</h2>
                {comparison.only_in_b.length === 0 ? (
                  <p className="text-sm text-slate-500">Nothing added.</p>
                ) : (
                  <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {comparison.only_in_b.map((d) => (
                      <li key={d.cocktail_name} className="px-4 py-3 text-sm">
                        <p className="text-slate-900">{d.cocktail_name}</p>
                        <p className="text-xs text-slate-500">{fmtMoney(d.sale_price_p)} · {d.gp_pct.toFixed(1)}% GP</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
