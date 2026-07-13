import type { NextConfig } from 'next'

// The CSP moved to middleware.ts: it is nonce-based, so the policy is built
// per request. Every other security header stays here.

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The legal routes moved to match the URLs registered with external
  // services (OAuth app registrations point at /terms-of-service/ and
  // /privacy-policy/). Permanent redirects keep anything still linking
  // the old paths working.
  async redirects() {
    return [
      { source: '/privacy', destination: '/privacy-policy', permanent: true },
      { source: '/terms', destination: '/terms-of-service', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Denies every powerful feature the marketing site does not use.
          // Marketing origin only: the app at app.pour-iq.co.uk sets its own
          // headers (it uses the camera for barcode scanning).
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          // PRE-LAUNCH: belt-and-braces alongside the robots metadata in
          // app/layout.tsx. robots.txt only controls crawling, not
          // indexing — this header is what keeps stray URLs out of
          // results. Remove at launch (see README, "Launch day").
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ]
  },
}

export default nextConfig
