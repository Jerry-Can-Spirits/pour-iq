import type { MetadataRoute } from 'next'

// PRE-LAUNCH: disallow all crawling. Note robots.txt controls crawling
// only — the indexing protection is the robots metadata (app/layout.tsx)
// and the X-Robots-Tag header (next.config.ts). Replace at launch with
// an allow-all file plus a sitemap reference (see README, "Launch day").
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  }
}
