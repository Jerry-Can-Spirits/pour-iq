import type { MenuTheme } from './types'

export interface ThemeTokens {
  page: string
  title: string
  sub: string
  section: string
  drinkName: string
  price: string
  desc: string
}

const THEMES: Record<MenuTheme, ThemeTokens> = {
  heritage: {
    page: 'bg-stone-900 text-amber-100',
    title: 'font-serif text-amber-300 tracking-widest uppercase',
    sub: 'text-amber-200/70 font-serif italic',
    section: 'border-b border-amber-700 text-amber-300 font-serif uppercase tracking-wider',
    drinkName: 'font-serif text-amber-100',
    price: 'text-amber-400 font-semibold',
    desc: 'text-amber-100/60 text-sm italic',
  },
  premium: {
    page: 'bg-gray-900 text-gray-100',
    title: 'font-sans text-white tracking-[0.2em] uppercase font-light',
    sub: 'text-gray-400 text-sm tracking-widest',
    section: 'border-b border-gray-600 text-gray-300 uppercase tracking-widest text-xs',
    drinkName: 'text-white font-medium',
    price: 'text-gray-300',
    desc: 'text-gray-500 text-sm',
  },
  clean: {
    page: 'bg-white text-gray-900',
    title: 'font-sans text-gray-900 font-bold tracking-tight',
    sub: 'text-gray-500',
    section: 'border-b border-gray-200 text-gray-700 font-semibold',
    drinkName: 'text-gray-900 font-medium',
    price: 'text-gray-700 font-semibold',
    desc: 'text-gray-500 text-sm',
  },
  casual: {
    page: 'bg-orange-50 text-gray-800',
    title: 'font-sans text-gray-800 font-bold',
    sub: 'text-orange-700/70',
    section: 'border-b-2 border-orange-300 text-orange-800 font-bold',
    drinkName: 'text-gray-800 font-medium',
    price: 'text-orange-700 font-bold',
    desc: 'text-gray-500 text-sm',
  },
  bold: {
    page: 'bg-black text-white',
    title: 'font-sans text-white font-black uppercase tracking-tight text-4xl',
    sub: 'text-white/70 font-bold uppercase tracking-widest text-xs',
    section: 'border-b-2 border-white text-white font-black uppercase',
    drinkName: 'text-white font-bold',
    price: 'text-white font-black',
    desc: 'text-white/60 text-sm',
  },
  classic: {
    page: 'bg-neutral-50 text-neutral-800',
    title: 'font-serif text-neutral-800 font-bold',
    sub: 'text-neutral-500 font-serif italic',
    section: 'border-b border-neutral-300 text-neutral-600 font-semibold uppercase tracking-wide text-sm',
    drinkName: 'text-neutral-800',
    price: 'text-neutral-700 font-semibold',
    desc: 'text-neutral-500 text-sm',
  },
}

export function menuTheme(t: MenuTheme | (string & {})): ThemeTokens {
  return THEMES[t as MenuTheme] ?? THEMES.clean
}
