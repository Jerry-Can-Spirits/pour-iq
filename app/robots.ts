import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/metadata'

// PRE-LAUNCH: disallow all crawling. Note robots.txt controls crawling
// only — the indexing protection is the robots metadata (app/layout.tsx)
// and the X-Robots-Tag header (next.config.ts). At launch, switch the
// rule to allow (see README, "Launch day"). The sitemap reference is
// already in place so the flip is a one-line change.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
