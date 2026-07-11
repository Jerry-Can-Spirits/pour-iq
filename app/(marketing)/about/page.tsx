import { buildMetadata } from '@/lib/metadata'

export const metadata = buildMetadata({
  title: 'About Dan Freeman',
  description:
    'Twelve years in the Royal Corps of Signals, a spirits brand sold venue by venue, and Pour IQ, built from watching good bars lose margin they could not see.',
  ogDescription:
    'Twelve years in the Royal Corps of Signals, then a tool built from watching good bars lose margin they could not see.',
  path: '/about',
})

export default function AboutPage() {
  return <h1>About</h1>
}
