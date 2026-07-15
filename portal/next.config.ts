import type { NextConfig } from 'next'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

// The Pour IQ portal: the authenticated app at app.pour-iq.co.uk, ported
// from the Jerry Can Spirits repo (Phase 2 of the README plan). Fully
// dynamic — every page sits behind the trade session, so no static
// prerender concerns apply here.
initOpenNextCloudflareForDev()

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          {
            // The marketing site's deny list with one exception: the
            // camera, self only, which the barcode scanner needs. The
            // CSP lives in middleware.ts (nonce-based, per request).
            key: 'Permissions-Policy',
            value:
              'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
