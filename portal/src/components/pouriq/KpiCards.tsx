import type { MenuMetrics, MenuRow } from '@/lib/pouriq/types'
import { SECTION_LABEL } from '@/lib/pouriq/ui'

function formatGp(pct: number) { return `${pct.toFixed(1)}%` }
function formatMoney(p: number) { return `£${(p / 100).toFixed(2)}` }

export function KpiCards({ menu, metrics }: { menu: MenuRow; metrics: MenuMetrics }) {
  const gpDelta = metrics.headline_gp_pct - menu.target_gp_pct
  const gpLabel = metrics.headline_basis === 'blended' ? 'Blended GP' : 'Average GP'
  const gpNote =
    `${gpDelta >= 0 ? '+' : ''}${gpDelta.toFixed(1)} vs target` +
    (metrics.headline_basis === 'average' ? ' · no sales data yet' : '') +
    (metrics.incomplete_cost_count > 0 ? ` · ${metrics.incomplete_cost_count} excluded (cost incomplete)` : '')
  const gpValueCls = gpDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'
  const items = [
    { label: gpLabel, value: formatGp(metrics.headline_gp_pct), note: gpNote, valueCls: gpValueCls },
    { label: 'Best margin', value: metrics.best_margin ? formatMoney(metrics.best_margin.margin_p) : '—', note: metrics.best_margin?.name ?? '', valueCls: 'text-slate-900' },
    { label: 'Worst margin', value: metrics.worst_margin ? formatMoney(metrics.worst_margin.margin_p) : '—', note: metrics.worst_margin?.name ?? '', valueCls: 'text-slate-900' },
    { label: 'Waste risk flags', value: String(metrics.waste_risk_count), note: 'Single-use ingredients', valueCls: 'text-slate-900' },
  ]
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((i) => (
        <div key={i.label} className="bg-white border border-slate-200 rounded-xl p-5">
          <p className={`${SECTION_LABEL} mb-2`}>{i.label}</p>
          <p className={`${i.valueCls} text-2xl font-bold mb-1`}>{i.value}</p>
          <p className="text-slate-500 text-xs">{i.note}</p>
        </div>
      ))}
    </div>
  )
}
