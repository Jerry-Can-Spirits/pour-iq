import { LegalMailto, LegalPage, type LegalSection } from '@/components/marketing/legal-page'
import { buildMetadata } from '@/lib/metadata'
import { termsLastUpdated } from '@/lib/legal'

export const metadata = buildMetadata({
  title: 'Terms of service',
  description: 'Pour IQ terms of service.',
  path: '/terms-of-service',
})

// Approved legal copy (Dan, 2026-07-12), byte-exact. Per CLAUDE.md, this
// copy and lib/legal.ts's termsLastUpdated change only together and only
// on explicit instruction.
const sections: LegalSection[] = [
  {
    num: '01',
    title: 'Who we are.',
    paras: [
      <>
        Pour IQ is operated by Jerry Can Spirits Ltd, company number 16618770, registered in England
        and Wales at 167-169 Great Portland Street, London, W1W 5PA. VAT registration GB 499 6389
        03. Contact: <LegalMailto />. Pour IQ™ is a registered trade mark of Jerry Can Spirits Ltd,
        UK trade mark UK00004387466, registered in Classes 9, 35, and 42.
      </>,
    ],
  },
  {
    num: '02',
    title: 'What these terms cover.',
    paras: [
      'These terms govern your subscription to and use of the Pour IQ platform. Pour IQ is a business tool provided to businesses. By subscribing, you confirm you are acting in the course of business and that the person accepting these terms is authorised to bind the venue.',
    ],
  },
  {
    num: '03',
    title: 'Your licence.',
    paras: [
      'While your subscription is active, we grant your venue a non-exclusive, non-transferable licence to use Pour IQ for its own business purposes. One subscription covers one venue. You may not resell, sublicense, or share access outside your venue, reverse engineer the platform, or use it to build a competing product.',
    ],
  },
  {
    num: '04',
    title: 'Subscriptions, pricing, and cancellation.',
    paras: [
      '(a) Monthly subscriptions run month to month. You may cancel at any time, in the product or by email, and cancellation takes effect at the end of the paid month. There are no notice periods and no exit fees. We do not offer pro-rata refunds for partial months.',
      '(b) Annual subscriptions run for twelve months. On your first annual purchase, you may cancel within fourteen days of payment for a full refund. After that period, or on renewal, cancelled annual subscriptions run to the end of their term without refund.',
      '(c) Founding rate. Venues subscribed at the founding rate keep that rate for as long as their subscription remains active. If your subscription ends and you later return, you rejoin at the then-current rate. A failed payment does not end the founding rate: you have thirty days to resolve payment before the subscription lapses.',
      "(d) Prices are stated exclusive of VAT, which is charged at the prevailing rate. We may change list prices with at least thirty days' notice; changes do not affect the founding rate lock or a paid annual term.",
    ],
  },
  {
    num: '05',
    title: 'Fair use.',
    paras: [
      "Invoice scanning and other AI-powered features are intended for your venue's own supplier documentation at normal business volumes. As a guide, sustained use far beyond typical venue volumes (for example, more than two hundred scans in a month) may be throttled. We will always contact you before restricting anything, and we will never surprise-bill you.",
    ],
  },
  {
    num: '06',
    title: 'Your data.',
    paras: [
      'The data you put into Pour IQ, and the analyses derived from it, belong to your venue. We process it only to provide the service, as described in our Privacy Policy. Pour IQ is built per-tenant: no feature exists that shows your data, including your supplier prices, to any other venue or to us in any product interface. On request, we will provide an export of your data. Your original uploaded invoices are downloadable by you at any time.',
    ],
  },
  {
    num: '07',
    title: 'Your responsibilities.',
    paras: [
      'You are responsible for the accuracy of the data you enter or approve, for keeping your login credentials confidential, and for all activity under your account. Pour IQ presents extracted invoice data for your review before anything is saved; the saved record is yours.',
    ],
  },
  {
    num: '08',
    title: 'Service and support.',
    paras: [
      'We aim to keep Pour IQ available at all times but do not guarantee uninterrupted service. Support is provided directly by the founder by email, with a response within one working day. We may update, improve, or modify features; we will not materially reduce the core functionality your subscription was purchased for during a paid term.',
    ],
  },
  {
    num: '09',
    title: 'Pour IQ is a tool, not an adviser.',
    paras: [
      'Pour IQ provides cost analysis and record keeping to support your decisions. It does not provide accounting, tax, or legal advice, and its outputs do not replace your obligations, including your responsibility to verify supplier AWRS registration and to meet HMRC record-keeping requirements. Decisions made using Pour IQ remain yours.',
    ],
  },
  {
    num: '10',
    title: 'Liability.',
    paras: [
      'Nothing in these terms excludes liability that cannot lawfully be excluded, including for death or personal injury caused by negligence, or for fraud. Subject to that, our total liability arising out of or in connection with Pour IQ in any twelve-month period is limited to the subscription fees you paid in that period, and we are not liable for indirect or consequential losses, loss of profit, or loss of data caused by factors outside our reasonable control.',
    ],
  },
  {
    num: '11',
    title: 'Suspension and termination.',
    paras: [
      'We may suspend or terminate access for material breach of these terms, including fair-use abuse after contact, or non-payment beyond the grace period. You may delete individual data at any time and may request full deletion as described in the Privacy Policy.',
    ],
  },
  {
    num: '12',
    title: 'Changes to these terms.',
    paras: [
      'We may update these terms from time to time. Material changes will be notified by email at least thirty days before they take effect. Continued use after that date constitutes acceptance.',
    ],
  },
  {
    num: '13',
    title: 'General.',
    paras: [
      'These terms are governed by the laws of England and Wales, and the courts of England and Wales have exclusive jurisdiction. If any provision is unenforceable, the remainder stays in force. These terms are the entire agreement between us concerning Pour IQ.',
    ],
  },
]

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of service."
      headingId="terms-heading"
      sections={sections}
      lastUpdated={termsLastUpdated}
    />
  )
}
