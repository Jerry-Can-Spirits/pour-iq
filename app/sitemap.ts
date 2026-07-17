import type { MetadataRoute } from 'next'
import { privacyLastUpdated, termsLastUpdated } from '@/lib/legal'
import { siteUrl } from '@/lib/metadata'

// The eight marketing routes. Ready for launch day; the site stays
// noindexed until then (robots metadata + X-Robots-Tag + robots.ts).
// The two legal routes carry lastModified from their single source of
// truth (lib/legal.ts); the rest have no meaningful per-route date yet.
const routes: { path: string; lastModified?: string }[] = [
  { path: '' },
  { path: '/pricing' },
  { path: '/about' },
  { path: '/case-studies' },
  { path: '/faq' },
  { path: '/contact' },
  { path: '/privacy-policy', lastModified: privacyLastUpdated },
  { path: '/terms-of-service', lastModified: termsLastUpdated },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(({ path, lastModified }) => ({
    url: `${siteUrl}${path}`,
    ...(lastModified && { lastModified }),
  }))
}
