import Link from 'next/link'
import type { MenuBalanceResult, MenuBalanceGroupKey } from '@/lib/pouriq/menu-balance'
import { MENU_BALANCE_LABELS, MENU_BALANCE_ORDER } from '@/lib/pouriq/menu-balance'

interface Props {
  result: MenuBalanceResult
  targetGpPct: number | null
  incompleteCount: number
  hasSalesData: boolean
}

const GROUP_COLOUR: Record<MenuBalanceGroupKey, string> = {
  strong: 'text-emerald-600',
  'popular-low-margin': 'text-amber-600',
  'high-margin-low-sales': 'text-sky-600',
  underperformers: 'text-rose-600',
}

export function MenuBalance({ result, targetGpPct, incompleteCount, hasSalesData }: Props) {
  if (result.includedCount === 0) {
    return (
      <p className="text-sm text-slate-500">
        Add costs and prices to your drinks to see your menu balance.
      </p>
    )
  }

  if (!hasSalesData) {
    return (
      <p className="text-sm text-slate-500">
        Add sales data (
        <Link
          href="/settings/integrations"
          className="text-emerald-700 hover:text-emerald-600 underline underline-offset-2"
        >
          sync your POS or enter volumes
        </Link>
        ) to see your menu balance.
      </p>
    )
  }

  const usedAvg = !targetGpPct || targetGpPct <= 0
  const thresholdLabel = usedAvg
    ? `your average GP of ${result.marginThreshold}%`
    : `your target GP of ${result.marginThreshold}%`

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        {MENU_BALANCE_ORDER.map((key) => {
          const drinks = result.groups[key]
          if (drinks.length === 0) return null
          const { title, action } = MENU_BALANCE_LABELS[key]
          return (
            <div
              key={key}
              className="bg-white border border-slate-200 rounded-xl p-5"
            >
              <p className={`text-xs uppercase tracking-widest mb-0.5 font-semibold ${GROUP_COLOUR[key]}`}>
                {title}
              </p>
              <p className="text-slate-500 text-xs mb-3">{action}</p>
              <ul className="space-y-1.5">
                {drinks.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-700 truncate">{d.name}</span>
                    <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
                      {d.gp_pct.toFixed(1)}% GP, {d.units} sold
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-500">
        Measured against {thresholdLabel} and {Math.ceil(result.popularityThreshold)}+ sales.
        {incompleteCount > 0 && (
          <> {incompleteCount} drink{incompleteCount === 1 ? '' : 's'} not shown (missing cost or price).</>
        )}
      </p>
    </div>
  )
}
