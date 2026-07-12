import type { NextConfig } from 'next'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

// The Pour IQ portal: the authenticated app at app.pour-iq.co.uk, ported
// from the Jerry Can Spirits repo (Phase 2 of the README plan). Fully
// dynamic — every page sits behind the trade session, so no static
// prerender concerns apply here.
initOpenNextCloudflareForDev()

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default nextConfig
