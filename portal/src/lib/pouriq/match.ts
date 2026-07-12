// Deterministic name matching of an extracted ingredient against the
// tenant's library. Returns a match status the UI can render directly.

import type { IngredientLibraryRow } from './types'

export type MatchStatus =
  | { kind: 'auto'; entry: IngredientLibraryRow }
  | { kind: 'suggestions'; entries: IngredientLibraryRow[] }
  | { kind: 'no-match' }

export function normalise(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/['.,]/g, '')
    .replace(/\b(\d+\s?(?:ml|cl|l|oz))\b/g, '') // strip size suffixes like "70cl"
    .replace(/\s+/g, ' ')
    .trim()
}

// Standard Levenshtein, O(n*m) — fine for short ingredient names.
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

// Leading/embedded qualifier words that describe preparation or tier rather
// than the ingredient itself. Stripped before matching so "fresh strawberry
// puree" == "strawberry puree" and a recipe's bare "gin" == a bar's "House Gin".
const QUALIFIER_WORDS = new Set(['fresh', 'house', 'well'])

export function significantTokens(name: string): string[] {
  return normalise(name)
    .split(' ')
    .filter((t) => t.length > 0 && !QUALIFIER_WORDS.has(t))
}

export function tokenKey(tokens: string[]): string {
  return [...tokens].sort().join(' ')
}

// Same token count, at most one differing token, and that token is only a
// small typo apart (length-scaled so short words like gin/rum aren't conflated
// with mint/rom-style 2-edit neighbours). Returns false for whole-word flips
// such as "lemon juice" vs "lemon slice".
export function tokensAreTypoNear(a: string[], b: string[]): boolean {
  if (a.length !== b.length || a.length === 0) return false
  let diffs = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue
    const allowed = Math.max(a[i].length, b[i].length) <= 5 ? 1 : 2
    if (levenshtein(a[i], b[i]) > allowed) return false
    if (++diffs > 1) return false
  }
  return diffs === 1
}

export function matchIngredient(
  extractedName: string,
  library: IngredientLibraryRow[],
): MatchStatus {
  const tTokens = significantTokens(extractedName)
  if (tTokens.length === 0) return { kind: 'no-match' }
  const tKey = tokenKey(tTokens)

  // 1. Confident equality — identical significant-token set (after qualifier
  //    stripping). Only this auto-selects; everything else is a suggestion the
  //    user confirms, so a near-miss can never silently fill the wrong thing.
  const exact = library.find((e) => {
    const c = significantTokens(e.name)
    return c.length > 0 && tokenKey(c) === tKey
  })
  if (exact) return { kind: 'auto', entry: exact }

  // 2. Plausible near-misses → suggestions only.
  type Scored = { entry: IngredientLibraryRow; score: number }
  const scored: Scored[] = []
  const tSet = new Set(tTokens)
  for (const entry of library) {
    const cTokens = significantTokens(entry.name)
    if (cTokens.length === 0) continue
    const cSet = new Set(cTokens)

    // a) one significant-token set fully contains the other
    //    (e.g. "triple sec" ↔ "cointreau triple sec").
    const subset =
      tTokens.every((t) => cSet.has(t)) || cTokens.every((c) => tSet.has(c))
    if (subset) {
      scored.push({ entry, score: Math.abs(tTokens.length - cTokens.length) })
      continue
    }
    // b) a single-token typo (e.g. "dark rom" → "Dark Rum").
    if (tokensAreTypoNear(tTokens, cTokens)) {
      scored.push({ entry, score: 10 })
    }
  }

  if (scored.length === 0) return { kind: 'no-match' }
  scored.sort((a, b) => a.score - b.score)
  return { kind: 'suggestions', entries: scored.slice(0, 3).map((s) => s.entry) }
}

// One unambiguous containment match for UI pre-selection. Returns the sole
// library entry whose significant tokens fully contain, or are contained by,
// the line's tokens — but NOT an exact token-set equal (that is matchIngredient's
// `auto` job) and NOT when more than one entry qualifies (ambiguous — user picks).
export function singleContainmentMatch(
  extractedName: string,
  library: IngredientLibraryRow[],
): IngredientLibraryRow | null {
  const t = significantTokens(extractedName)
  if (t.length === 0) return null
  const tKey = tokenKey(t)
  const tSet = new Set(t)
  const hits: IngredientLibraryRow[] = []
  for (const e of library) {
    const c = significantTokens(e.name)
    if (c.length === 0) continue
    if (tokenKey(c) === tKey) return null // exact equal exists — not our job
    const cSet = new Set(c)
    const contains = t.every((x) => cSet.has(x)) || c.every((x) => tSet.has(x))
    if (contains) hits.push(e)
    if (hits.length > 1) return null
  }
  return hits.length === 1 ? hits[0] : null
}
