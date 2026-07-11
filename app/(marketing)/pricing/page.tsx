import { buildMetadata } from '@/lib/metadata'

export const metadata = buildMetadata({
  title: 'Pricing',
  description:
    'One monthly price, no contract, cancel any time. See what Pour IQ costs and what a venue loses each month without it.',
  path: '/pricing',
})

export default function PricingPage() {
  return <h1>Pricing</h1>
}
