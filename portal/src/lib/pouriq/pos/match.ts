import type { CocktailRow } from '../types'

export function normalise(s: string): string {
  return s.toLowerCase().replace(/['.,]/g, '').replace(/\s+/g, ' ').trim()
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const prev = new Array(b.length + 1)
  const cur = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]
  }
  return prev[b.length]
}

export function matchPosItemToCocktail(
  itemName: string,
  cocktails: CocktailRow[],
): CocktailRow | null {
  const target = normalise(itemName)
  if (!target) return null
  const exact = cocktails.find((c) => normalise(c.name) === target)
  if (exact) return exact
  let best: { cocktail: CocktailRow; score: number } | null = null
  for (const c of cocktails) {
    const candidate = normalise(c.name)
    if (candidate.length < 3) continue
    const dist = levenshtein(target, candidate)
    if (dist <= 2 && (best === null || dist < best.score)) {
      best = { cocktail: c, score: dist }
    }
  }
  return best?.cocktail ?? null
}

// Nearest cocktail by edit distance, ignoring the auto-match threshold.
// Used to pre-fill a best-guess in the unmatched-items review screen.
export function bestGuessCocktail<T extends { name: string }>(
  itemName: string,
  cocktails: T[],
): T | null {
  const target = normalise(itemName)
  if (!target || cocktails.length === 0) return null
  let best: { cocktail: T; score: number } | null = null
  for (const c of cocktails) {
    const dist = levenshtein(target, normalise(c.name))
    if (best === null || dist < best.score) best = { cocktail: c, score: dist }
  }
  return best?.cocktail ?? null
}
