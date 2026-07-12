import Link from 'next/link'
import type { CocktailMetrics, CocktailRow } from '@/lib/pouriq/types'
import { GenerateDescriptionModal } from '@/components/pouriq/GenerateDescriptionModal'
import { STATUS_LABEL, type PerfStatus } from '@/lib/pouriq/menu-performance'

function formatMoney(p: number) { return `£${(p / 100).toFixed(2)}` }

function statusClass(s: PerfStatus | undefined): string {
  switch (s) {
    case 'winner': return 'text-emerald-600'
    case 'promote': return 'text-sky-600'
    case 'fix-margin': return 'text-amber-600'
    case 'review': case 'missing-cost': case 'needs-price': return 'text-rose-600'
    default: return 'text-slate-500'
  }
}

interface Props {
  menuId: string
  cocktails: CocktailRow[]
  metrics: CocktailMetrics[]
  targetGpPct: number
  statusById: Record<string, PerfStatus>
}

export function CocktailTable({ menuId, cocktails, metrics, targetGpPct, statusById }: Props) {
  const byId = new Map(metrics.map((m) => [m.cocktail_id, m]))
  const rows = cocktails.map((c) => ({ cocktail: c, m: byId.get(c.id)! })).filter((r) => r.m)

  const anyPromo = rows.some((r) => r.m.promo)
  const anyVolume = rows.some((r) => r.m.volume)

  // When volumes exist, contribution is the meaningful sort. Falls back
  // to absolute margin order otherwise (current behaviour). Drinks with
  // incomplete cost data sort last — their margin is understated/inflated,
  // so they must not top the table.
  const rank = (m: CocktailMetrics) => (m.cost_complete ? 1 : 0)
  if (anyVolume) {
    rows.sort((a, b) => rank(b.m) - rank(a.m) || (b.m.volume?.contribution_p ?? -1) - (a.m.volume?.contribution_p ?? -1))
  } else {
    rows.sort((a, b) => rank(b.m) - rank(a.m) || b.m.margin_p - a.m.margin_p)
  }

  const extraCols = (anyPromo ? 1 : 0) + (anyVolume ? 2 : 0)
  const minWidth = extraCols >= 2 ? 'min-w-[1120px]' : extraCols === 1 ? 'min-w-[980px]' : 'min-w-[760px]'

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto print:overflow-visible">
      <table className={`w-full text-sm ${minWidth} print:min-w-0 print:text-[10px] print:[&_th]:px-1.5 print:[&_th]:py-1 print:[&_td]:px-1.5 print:[&_td]:py-1`}>
        <thead className="bg-slate-50">
          <tr className="text-left text-slate-500 text-xs uppercase tracking-widest">
            <th className="px-4 py-3">Drink</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Pour cost</th>
            <th className="px-4 py-3">Margin</th>
            <th className="px-4 py-3">GP %</th>
            {anyPromo && <th className="px-4 py-3">Promo · GP %</th>}
            {anyVolume && <th className="px-4 py-3">Units</th>}
            {anyVolume && <th className="px-4 py-3">Contribution</th>}
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ cocktail, m }) => {
            const incomplete = !m.cost_complete
            const belowTarget = m.gp_pct < targetGpPct
            const promo = m.promo
            const volume = m.volume
            const promoBelowTarget = promo ? promo.gp_pct < targetGpPct : false
            return (
              <tr key={cocktail.id} className="border-t border-slate-200">
                <td className="px-4 py-3 text-slate-900">
                  {cocktail.name}
                  {cocktail.field_manual_slug && (
                    <a href={`/field-manual/cocktails/${cocktail.field_manual_slug}`} className="ml-2 text-xs text-emerald-700 hover:text-emerald-600 underline">
                      Field Manual
                    </a>
                  )}
                  {cocktail.description && (
                    <p className="text-sm text-slate-600 italic mt-2">{cocktail.description}</p>
                  )}
                  <div className="no-print mt-1">
                    <GenerateDescriptionModal
                      cocktailId={cocktail.id}
                      cocktailName={cocktail.name}
                      existingDescription={cocktail.description ?? null}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">{formatMoney(m.sale_price_p)}</td>
                <td className="px-4 py-3 text-slate-700">{formatMoney(m.pour_cost_p)}</td>
                <td className="px-4 py-3 text-slate-900">{formatMoney(m.margin_p)}</td>
                <td className={`px-4 py-3 ${incomplete ? 'text-amber-600' : belowTarget ? 'text-rose-600' : 'text-slate-900'}`}>
                  {incomplete ? (
                    <Link href={`/${menuId}/edit?cocktail=${cocktail.id}`} className="text-amber-600 hover:text-amber-700 underline">
                      ⚠ Cost incomplete — add prices
                    </Link>
                  ) : (
                    `${m.gp_pct.toFixed(1)}%`
                  )}
                </td>
                {anyPromo && (
                  <td className="px-4 py-3">
                    {promo ? (
                      <span className={promoBelowTarget ? 'text-rose-600' : 'text-amber-600'}>
                        {formatMoney(promo.sale_price_p)} · {promo.gp_pct.toFixed(1)}%
                        {promo.label && <span className="block text-[10px] text-slate-500 mt-0.5">{promo.label}</span>}
                        {promo.active_today && (
                          <span className="inline-block text-[10px] mt-0.5 px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-600">Active today</span>
                        )}
                        {!promo.active_today && (promo.days || promo.valid_from || promo.valid_until) && (
                          <span className="block text-[10px] text-slate-500 mt-0.5">
                            {promo.days ? promo.days.map((n) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][n]).join(' ') : 'Every day'}
                            {(promo.valid_from || promo.valid_until) && (
                              <> · {promo.valid_from ?? '…'} → {promo.valid_until ?? '…'}</>
                            )}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                )}
                {anyVolume && (
                  <td className="px-4 py-3 text-slate-700">
                    {volume ? volume.units_sold : <span className="text-slate-400">—</span>}
                  </td>
                )}
                {anyVolume && (
                  <td className="px-4 py-3 text-slate-900">
                    {volume ? formatMoney(volume.contribution_p) : <span className="text-slate-400">—</span>}
                  </td>
                )}
                <td className={`px-4 py-3 ${statusClass(statusById[cocktail.id])}`}>
                  {statusById[cocktail.id] ? STATUS_LABEL[statusById[cocktail.id]] : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/${menuId}/edit?cocktail=${cocktail.id}`} className="text-emerald-700 hover:text-emerald-600 underline text-xs">Edit</Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
