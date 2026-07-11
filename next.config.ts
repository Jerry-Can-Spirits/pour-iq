import type { NextConfig } from 'next'

// INTERIM CSP — documented in the README with a TODO to move to a
// nonce-based policy before launch. Next.js hydration requires inline
// scripts, and nonces would force every marketing page to render
// dynamically, so the pre-launch trade-off is 'unsafe-inline' with
// everything else locked to 'self'. 'unsafe-eval' is added in
// development only (HMR / Fast Refresh needs it).
const isDev = process.env.NODE_ENV !== 'production'
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
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
