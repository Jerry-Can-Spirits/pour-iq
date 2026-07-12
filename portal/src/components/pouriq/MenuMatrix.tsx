import type { MenuPerformance } from '@/lib/pouriq/menu-performance'

const TONES = {
  winner: { card: 'border-emerald-300 bg-emerald-50 print:border-emerald-600', label: 'text-emerald-700', chip: 'border-emerald-300' },
  promote: { card: 'border-sky-300 bg-sky-50 print:border-sky-600', label: 'text-sky-700', chip: 'border-sky-300' },
  fix: { card: 'border-amber-300 bg-amber-50 print:border-amber-600', label: 'text-amber-700', chip: 'border-amber-300' },
  review: { card: 'border-rose-300 bg-rose-50 print:border-rose-600', label: 'text-rose-700', chip: 'border-rose-300' },
} as const

function Quadrant({ label, tone, drinks }: { label: string; tone: keyof typeof TONES; drinks: Array<{ cocktail_id: string; name: string }> }) {
  const t = TONES[tone]
  return (
    <div className={`rounded-lg border p-3 min-h-[92px] ${t.card}`}>
      <p className={`text-[11px] uppercase tracking-widest ${t.label}`}>{label}</p>
      {drinks.length === 0 ? (
        <p className="text-slate-400 text-sm mt-2">—</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {drinks.map((d) => (
            <span key={d.cocktail_id} className={`text-xs rounded-full border px-2 py-0.5 text-slate-700 ${t.chip}`}>{d.name}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export function MenuMatrix({ quadrants }: { quadrants: MenuPerformance['quadrants'] }) {
  const colHead = 'text-[11px] uppercase tracking-widest text-slate-500 text-center'
  const rowHead = 'text-[11px] uppercase tracking-widest text-slate-500 flex items-center'
  return (
    <div>
      <div className="grid grid-cols-[5rem_1fr_1fr] gap-2 items-end mb-1.5">
        <div />
        <div className={colHead}>Popular sellers</div>
        <div className={colHead}>Slow sellers</div>
      </div>
      <div className="grid grid-cols-[5rem_1fr_1fr] gap-2 mb-2">
        <div className={rowHead}>Good margin</div>
        <Quadrant label={'Winners · feature & protect'} tone="winner" drinks={quadrants.winner} />
        <Quadrant label="Promote · good margin, under-sold" tone="promote" drinks={quadrants.promote} />
      </div>
      <div className="grid grid-cols-[5rem_1fr_1fr] gap-2">
        <div className={rowHead}>Thin margin</div>
        <Quadrant label="Fix the margin · popular but thin" tone="fix" drinks={quadrants.fixMargin} />
        <Quadrant label="Review or cut" tone="review" drinks={quadrants.review} />
      </div>
      <p className="text-xs text-slate-500 mt-3">
        A popular seller sells at least 70% of what an average drink on this menu sells. Good margin is at or above your Target GP.
      </p>
    </div>
  )
}
