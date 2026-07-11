import { buildMetadata } from '@/lib/metadata'

export const metadata = buildMetadata({
  title: 'FAQ',
  description:
    'Straight answers on invoice scanning, data security, AWRS compliance, contract terms, and getting a venue onboarded.',
  path: '/faq',
})

export default function FaqPage() {
  return <h1>Frequently asked questions</h1>
}
