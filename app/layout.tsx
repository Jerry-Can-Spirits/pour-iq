import type { Metadata } from 'next'
import './globals.css'

const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000'

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
    <html lang="en-GB">
      <body className="antialiased">
        <header>
          <nav aria-label="Primary">{/* Site navigation arrives with the design pass. */}</nav>
        </header>
        <main id="main-content">{children}</main>
        <footer>
          <p>Built by Jerry Can Spirits Ltd.</p>
        </footer>
      </body>
    </html>
  )
}
