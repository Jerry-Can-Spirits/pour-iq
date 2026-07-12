import 'server-only'

// The Field Manual lives in the Jerry Can Spirits Sanity project (public,
// read-only content — the project id appears in every cdn.sanity.io URL).
// Post entity-split, Pour IQ queries it over Sanity's public HTTP API
// rather than carrying the JCS Sanity client.
const SANITY_PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '5mtjmb0t'
const SANITY_DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'
const SANITY_API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2025-09-08'

const sanityClient = {
  async fetch<T>(groq: string): Promise<T> {
    const url = `https://${SANITY_PROJECT_ID}.api.sanity.io/v${SANITY_API_VERSION}/data/query/${SANITY_DATASET}?query=${encodeURIComponent(groq)}&perspective=published`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Sanity query failed: ${res.status}`)
    const body = (await res.json()) as { result: T }
    return body.result
  },
}

interface SanityCocktail {
  name: string
  slug: string
}

let cache: { entries: SanityCocktail[]; expiresAt: number } | null = null
const CACHE_TTL_MS = 15 * 60 * 1000

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function loadCatalog(): Promise<SanityCocktail[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.entries
  const result = await sanityClient.fetch<SanityCocktail[]>(
    `*[_type == "cocktail" && defined(slug.current)]{ name, "slug": slug.current }`
  )
  cache = { entries: result, expiresAt: Date.now() + CACHE_TTL_MS }
  return result
}

export async function matchFieldManualSlug(cocktailName: string): Promise<string | null> {
  if (!cocktailName.trim()) return null
  const catalog = await loadCatalog()
  const target = normaliseName(cocktailName)
  const exact = catalog.find((c) => normaliseName(c.name) === target)
  return exact?.slug ?? null
}

export function fieldManualUrl(slug: string): string {
  return `https://jerrycanspirits.co.uk/field-manual/cocktails/${slug}`
}
