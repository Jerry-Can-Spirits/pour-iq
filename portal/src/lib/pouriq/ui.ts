// Shared Tailwind class strings for the Pour IQ trade portal's light
// ("Daylight") identity. Single source of truth for surfaces, inputs, labels,
// tables and status colours so the look stays consistent across every page.
// Pour IQ uses stock Tailwind (slate/white/emerald/amber/rose); the consumer
// site keeps jerry-green/gold/parchment.

export const CANVAS = 'bg-slate-50'
export const CARD = 'bg-white border border-slate-200 rounded-xl'
export const CARD_PAD = 'bg-white border border-slate-200 rounded-xl p-6'
export const PANEL = 'bg-white border border-slate-200 rounded-lg'

export const INPUT =
  'w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden transition-colors duration-200'
export const SELECT = INPUT

export const LABEL = 'block text-sm font-medium text-slate-700 mb-2'
export const HELPER = 'text-xs text-slate-500 mt-1.5'
export const SECTION_LABEL = 'text-xs font-semibold uppercase tracking-widest text-slate-500'
export const PAGE_TITLE = 'text-3xl md:text-4xl font-bold text-slate-900 tracking-tight'
export const HEADING = 'text-lg font-bold text-slate-900'

export const TABLE_WRAP = 'overflow-hidden rounded-xl border border-slate-200'
export const TABLE_HEAD = 'bg-slate-50 text-left text-slate-500 text-xs uppercase tracking-widest'
export const TABLE_ROW = 'border-t border-slate-200 hover:bg-slate-50'

export const CHIP = 'px-3 py-2 rounded-lg border text-sm transition-colors'
export const CHIP_ACTIVE = 'bg-emerald-50 border-emerald-600 text-emerald-700'
export const CHIP_IDLE = 'bg-white border-slate-300 text-slate-600 hover:border-emerald-400'

export const EMPTY_STATE = 'bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500'

// Severity → text colour (variance, GP traffic-lights, attention).
export type Severity = 'good' | 'watch' | 'bad' | 'neutral'
export function statusText(sev: Severity): string {
  return sev === 'good' ? 'text-emerald-600'
    : sev === 'watch' ? 'text-amber-600'
    : sev === 'bad' ? 'text-rose-600'
    : 'text-slate-500'
}
export function statusDot(sev: Severity): string {
  const base = 'inline-block w-2 h-2 rounded-full '
  return base + (sev === 'good' ? 'bg-emerald-500'
    : sev === 'watch' ? 'bg-amber-500'
    : sev === 'bad' ? 'bg-rose-500'
    : 'bg-slate-300')
}
