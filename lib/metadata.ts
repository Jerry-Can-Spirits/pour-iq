import type { Metadata } from 'next'

export const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000'

// One shared static OG image for every page (per-page images can come later).
// Committed build asset — see scripts/generate-og-image.ps1. Runtime image
// generation is deliberately avoided (OpenNext/Workers compatibility risk).
const ogImage = {
  url: '/og.png',
  width: 1200,
  height: 630,
  alt: 'Pour IQ. Menu and cost engineering for UK bars.',
}

interface PageMetadataInput {
  /** Page title. Templated to "%s | Pour IQ" unless `absoluteTitle` is set. */
  title: string
  description: string
  /**
   * Social-preview override for openGraph.description and twitter.description
   * only (previews truncate near 125 characters; search snippets allow ~160).
   * When absent, `description` populates all three.
   */
  ogDescription?: string
  /** Route path with a leading slash and no trailing slash, e.g. '/pricing'. */
  path: string
  /** Home only: bypass the layout title template. */
  absoluteTitle?: boolean
}

// Every page's metadata flows through here. Relative URLs (canonical, og:url,
// og:image) resolve to absolute against metadataBase (set in app/layout.tsx
// from SITE_URL). Titles and descriptions are inherited by OpenGraph and
// Twitter from the resolved page values, so the layout title template applies
// to social tags as well.
export function buildMetadata({
  title,
  description,
  ogDescription,
  path,
  absoluteTitle = false,
}: PageMetadataInput): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: 'website',
      siteName: 'Pour IQ',
      locale: 'en_GB',
      url: path,
      images: [ogImage],
      ...(ogDescription && { description: ogDescription }),
    },
    twitter: {
      card: 'summary_large_image',
      images: [ogImage.url],
      ...(ogDescription && { description: ogDescription }),
    },
  }
}
