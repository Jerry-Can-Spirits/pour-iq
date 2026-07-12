import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/metadata'

// The eight marketing routes. Ready for launch day; the site stays
// noindexed until then (robots metadata + X-Robots-Tag + robots.ts).
const routes = [
  '',
  '/pricing',
  '/about',
  '/case-studies',
  '/faq',
  '/contact',
  '/privacy-policy',
  '/terms-of-service',
]

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
  }))
}
