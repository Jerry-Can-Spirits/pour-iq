import { buildMetadata } from '@/lib/metadata'

// Interim metadata until the legal pages are drafted.
export const metadata = buildMetadata({
  title: 'Terms',
  description: 'Pour IQ terms of service.',
  path: '/terms',
})

export default function TermsPage() {
  return <h1>Terms of service</h1>
}
