import Link from 'next/link'
import type { MenuRow } from '@/lib/pouriq/types'
import { MakeActiveButton } from './MakeActiveButton'

const ACTIVE_BADGE =
  'inline-block px-2 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-600 text-[10px] uppercase tracking-widest'

export function MenuListCard({ menu }: { menu: MenuRow }) {
  const updated = new Date(menu.updated_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 hover:border-emerald-600 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1">
        <Link href={`/${menu.id}`} className="text-lg font-bold text-slate-900 hover:text-emerald-700 transition-colors">
          {menu.name}
        </Link>
        {menu.is_active === 1
          ? <span className={ACTIVE_BADGE}>Active</span>
          : <MakeActiveButton menuId={menu.id} />}
      </div>
      <Link href={`/${menu.id}`} className="block">
        <p className="text-slate-500 text-xs uppercase tracking-widest mb-3">
          {menu.venue_type ?? 'Menu'}{menu.city && ` · ${menu.city}`}
        </p>
        <p className="text-slate-600 text-sm">
          Target GP {menu.target_gp_pct}% · Updated {updated}
        </p>
      </Link>
    </div>
  )
}
