import { buildMetadata } from '@/lib/metadata'

export const metadata = buildMetadata({
  title: 'Proof',
  description:
    "Real figures from real venues, starting with Pour IQ's first pilot at The Bank Bar and Grill. Published as they land.",
  path: '/case-studies',
})

export default function CaseStudiesPage() {
  return <h1>Case studies</h1>
}
