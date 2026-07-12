import type { CategoryGpRow } from '@/lib/pouriq/category-gp'

interface Props {
  rows: CategoryGpRow[]
  targetGpPct: number
  excludedCount: number
}

export function CategoryGpTable({ rows, targetGpPct, excludedCount }: Props) {
  if (rows.length === 0) return null

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900 mb-1">GP by category</h2>
      <p className="text-xs text-slate-400 mb-3">{targetGpPct}% target</p>
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-500 text-xs uppercase tracking-widest">
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Drinks</th>
              <th className="px-4 py-3 text-right">GP%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-700">{row.label}</td>
                <td className="px-4 py-3 text-right text-slate-700">{row.drink_count}</td>
                <td className={`px-4 py-3 text-right font-medium ${row.under_target ? 'text-amber-600' : 'text-slate-700'}`}>
                  {row.gp_pct.toFixed(1)}%
                  {row.basis === 'average' && (
                    <span className="ml-1 text-xs text-slate-400 font-normal">avg</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {excludedCount > 0 && (
        <p className="text-xs text-slate-400 mt-2">
          {excludedCount} drink{excludedCount === 1 ? '' : 's'} excluded (incomplete cost)
        </p>
      )}
    </div>
  )
}
