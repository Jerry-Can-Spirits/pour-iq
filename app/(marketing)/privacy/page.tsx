import { buildMetadata } from '@/lib/metadata'

// Interim metadata until the legal pages are drafted.
export const metadata = buildMetadata({
  title: 'Privacy policy',
  description: 'How Pour IQ handles your data.',
  path: '/privacy',
})

export default function PrivacyPage() {
  return <h1>Privacy policy</h1>
}
