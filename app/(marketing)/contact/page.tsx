import { buildMetadata } from '@/lib/metadata'

export const metadata = buildMetadata({
  title: 'Book a demo',
  description:
    'Book a Pour IQ demo for your venue. Built by Jerry Can Spirits for independent UK bars.',
  path: '/contact',
})

export default function ContactPage() {
  return <h1>Contact</h1>
}
