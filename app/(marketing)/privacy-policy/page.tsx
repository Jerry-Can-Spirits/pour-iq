import { LegalMailto, LegalPage, type LegalSection } from '@/components/marketing/legal-page'
import { buildMetadata } from '@/lib/metadata'
import { privacyLastUpdated } from '@/lib/legal'

export const metadata = buildMetadata({
  title: 'Privacy policy',
  description: 'How Pour IQ handles your data.',
  path: '/privacy-policy',
})

// Approved legal copy (Dan, 2026-07-12), byte-exact. Per CLAUDE.md, this
// copy and lib/legal.ts's privacyLastUpdated change only together and only
// on explicit instruction.
const sections: LegalSection[] = [
  {
    num: '01',
    title: 'Who is responsible for your data.',
    paras: [
      <>
        Jerry Can Spirits Ltd (company number 16618770, 167-169 Great Portland Street, London, W1W
        5PA) is the data controller for Pour IQ. We are registered with the Information
        Commissioner&apos;s Office. Contact: <LegalMailto />.
      </>,
    ],
  },
  {
    num: '02',
    title: 'This website.',
    paras: [
      'The Pour IQ marketing site sets no analytics cookies, no advertising pixels, and no tracking of any kind. The only data it collects is what you choose to send us through the demo booking form.',
    ],
  },
  {
    num: '03',
    title: 'Demo requests.',
    paras: [
      'When you book a demo we collect your name, venue name, email address, and optionally a phone number and message, with your consent recorded at the time of submission. This data is stored in Klaviyo (our email platform, processing in the United Kingdom and United States under UK adequacy regulations and Standard Contractual Clauses) and used to arrange and follow up your demo. It is retained until you ask us to delete it or two years after our last contact, whichever is sooner.',
    ],
  },
  {
    num: '04',
    title: 'Pour IQ platform data.',
    paras: [
      'If your venue holds a Pour IQ licence, we process the business data you enter: menus, recipes, ingredient costs, sale prices, supplier invoices, stock counts, and the analyses derived from them. The lawful basis is performance of our contract with you.',
    ],
  },
  {
    num: '05',
    title: 'How platform data flows.',
    paras: [
      '(a) AI processing. Uploaded invoices and menu data are sent to Anthropic PBC (United States) for extraction and analysis. Anthropic does not train its models on this data under its commercial terms. Transfers rely on the UK Extension to the EU-US Data Privacy Framework (the UK-US Data Bridge).',
      "(b) Storage. Your data is stored on Cloudflare's infrastructure under Cloudflare's Data Processing Addendum, encrypted in transit and at rest. Your original invoice PDFs are stored and remain downloadable by you.",
      '(c) Till and accounting integrations. If you connect them, we read sales data from Square, Zettle, or SumUp to power menu analysis, and we send invoice line data to Xero or QuickBooks to create draft bills. We do not read your accounting ledgers. Each connection is authorised by you and can be revoked by you at any time.',
      '(d) Tenancy. Pour IQ data is strictly per-venue. No feature shares your data, including your supplier prices, with any other venue or displays it to us.',
    ],
  },
  {
    num: '06',
    title: 'Retention.',
    paras: [
      "Platform data is retained for the life of your licence and for two years after cancellation, then deleted, except supplier invoice records, which are retained in line with HMRC's six-year record-keeping requirement. You can delete individual menus and records in the product at any time.",
    ],
  },
  {
    num: '07',
    title: 'Your rights.',
    paras: [
      <>
        You may request access to, correction of, export of, or deletion of your personal data by
        emailing <LegalMailto />. We respond within one month. Deletion is subject to the legal
        retention period for purchase records described above. You may withdraw consent for
        demo-request contact at any time.
      </>,
    ],
  },
  {
    num: '08',
    title: 'Complaints.',
    paras: [
      "You have the right to complain to the Information Commissioner's Office: ico.org.uk, 0303 123 1113, or Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF. We would appreciate the chance to address any concern first.",
    ],
  },
  {
    num: '09',
    title: 'Changes.',
    paras: [
      'Updates to this policy are posted on this page with a revised date; material changes affecting licence holders are notified by email.',
    ],
  },
]

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy policy."
      headingId="privacy-heading"
      sections={sections}
      lastUpdated={privacyLastUpdated}
    />
  )
}
