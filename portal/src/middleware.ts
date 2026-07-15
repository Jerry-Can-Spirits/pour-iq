import { NextRequest, NextResponse } from 'next/server'

// Nonce-based CSP, ported from the marketing site's reference
// implementation (the root app's middleware.ts) with app-appropriate
// scoping. The nonce rides the request headers so Next stamps it onto
// every script it renders; the full policy on the response is what the
// browser enforces. The portal is fully dynamic already (every page
// sits behind the trade session), so the nonce carries no rendering
// cost here.
//
// Scoping, from an audit of what the app actually loads: the portal
// connects only to its own API routes and serves every asset itself —
// no third-party scripts, no external image hosts, no websockets.
// Blob URLs appear only as <a download> exports (not CSP-gated) and
// the barcode scanner attaches its camera stream via srcObject (no
// media URL), so no blob:/media-src allowances are needed.
//
// style-src keeps 'unsafe-inline': portal components use inline style
// attributes (the same class of exception the marketing site documents
// for its token system). 'unsafe-eval' appears in development only —
// HMR needs it.

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
  // Static assets and prefetches skip the middleware: CSP governs
  // documents, and skipping keeps asset serving on the fast path.
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
