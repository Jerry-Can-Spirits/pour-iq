import type { Metadata } from 'next'
import { Bricolage_Grotesque, IBM_Plex_Mono, Instrument_Sans } from 'next/font/google'
import { tokenCssVariables } from '@/lib/design-tokens'
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

const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000'

// Facts only: no ratings, reviews, or aggregate data of any kind. The
// existing CSP (script-src 'self' 'unsafe-inline') permits inline JSON-LD.
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
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Pour IQ',
    template: '%s | Pour IQ',
  },
  description: 'Menu and cost engineering for independent UK bars. Built by Jerry Can Spirits Ltd.',
  // PRE-LAUNCH: keep the site out of search indexes until launch day.
  // Removal steps are documented in the README under "Launch day".
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en-GB"
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
      style={tokenCssVariables as React.CSSProperties}
    >
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {children}
      </body>
    </html>
  )
}
