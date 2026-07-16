import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// The authenticated Pour IQ app. Never indexed — the marketing site at
// pour-iq.co.uk is the public face.
export const metadata: Metadata = {
  title: {
    default: 'Pour IQ',
    template: '%s | Pour IQ',
  },
  robots: { index: false, follow: false },
}

// The app's "Daylight" identity is light — a white header on slate-50. Match
// the mobile browser chrome to it.
export const viewport: Viewport = {
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
