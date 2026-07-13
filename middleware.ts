import { NextRequest, NextResponse } from 'next/server'

// Nonce-based CSP per the Next.js guidance (a fresh nonce per request). The
// nonce is set on the request headers so Next stamps it onto every script it
// renders, and the full policy is set on the response so the browser
// enforces it. This replaces the interim 'unsafe-inline' policy that lived
// in next.config.ts; the other security headers stay there.
//
// The cost: pages that read the nonce render dynamically on every request
// (the root layout reads it via headers()). Measured against the static
// build before shipping — numbers in the PR that introduced this file.
//
// style-src keeps 'unsafe-inline': the design-token system inlines CSS
// custom properties on <html> (documented, accepted — see README).
// 'unsafe-eval' appears in development only (HMR needs it).

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const isDev = process.env.NODE_ENV !== 'production'
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
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

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  // Static assets and prefetches skip the middleware: CSP governs documents,
  // and skipping keeps asset serving on the fast path.
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-192.png|icon-512.png|apple-touch-icon.png|site.webmanifest|og.png|brand/).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
