import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Bricolage_Grotesque, IBM_Plex_Mono, Instrument_Sans } from 'next/font/google'
import { tokenCssVariables } from '@/lib/design-tokens'
import { siteUrl } from '@/lib/metadata'
import './globals.css'

// next/font self-hosts every face at build time — no runtime requests to a
// font CDN, so the CSP's font-src 'self' holds.
const displayFont = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-bricolage-grotesque',
  display: 'swap',
})

const bodyFont = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-instrument-sans',
  display: 'swap',
})

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
})

// Facts only: no ratings, reviews, or aggregate data of any kind. Rendered
// with the per-request CSP nonce (see middleware.ts).
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Jerry Can Spirits Ltd',
  url: 'https://jerrycanspirits.co.uk',
  founder: {
    '@type': 'Person',
    name: 'Dan Freeman',
  },
  brand: {
    '@type': 'Brand',
    name: 'Pour IQ',
    url: siteUrl,
  },
  // JSON-LD consumers prefer raster; the 512px tile is derived from the
  // vector source in public/brand (scripts/generate-brand-assets.mjs).
  logo: `${siteUrl}/icon-512.png`,
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Pour IQ',
    template: '%s | Pour IQ',
  },
  description: 'Menu and cost engineering for independent UK bars. Built by Jerry Can Spirits Ltd.',
  // Brand icons are generated from the vector sources in public/brand by
  // scripts/generate-brand-assets.mjs.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  // PRE-LAUNCH: keep the site out of search indexes until launch day.
  // Removal steps are documented in the README under "Launch day".
  robots: { index: false, follow: false },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Reading the per-request nonce (set by middleware.ts) is what opts every
  // page into dynamic rendering — the deliberate cost of the nonce-based
  // CSP. Next stamps its own scripts from the request CSP header; the
  // JSON-LD data block is stamped here explicitly.
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <html
      lang="en-GB"
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
      style={tokenCssVariables as React.CSSProperties}
    >
      <body className="antialiased">
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {children}
      </body>
    </html>
  )
}
