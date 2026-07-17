import { PageHero } from '@/components/marketing/page-hero'
import { buildMetadata } from '@/lib/metadata'

export const metadata = buildMetadata({
  title: 'Questions bar operators ask',
  description:
    'Straight answers on invoice scanning, data security, AWRS compliance, contract terms, and getting a venue onboarded.',
  path: '/faq',
})

// Final approved copy (Dan, 2026-07-12), grounded in the code-verified
// capability findings — honest built-in limits only, no invented claims.
// The FAQPage JSON-LD below is built from this same array, so schema and
// rendered copy cannot drift apart.
const groups = [
  {
    label: 'SCANNING',
    items: [
      {
        question: 'How does invoice scanning actually work?',
        answer:
          'You upload a supplier invoice as a PDF. Pour IQ reads every line in a few seconds and shows you what it found: products, quantities, net prices, VAT treatment. Nothing is saved until you have reviewed it. You can edit any price, point a line at a different ingredient, or drop a line entirely. Only when you press save does it commit.',
      },
      {
        question: 'What happens when it misreads something?',
        answer:
          'You correct it before saving, and the correction counts. Once a line is matched to an ingredient in your library, future invoices from that supplier match it automatically, so accuracy improves with use. Lines it cannot read are skipped rather than guessed, and very long invoices get a warning to check the final lines. It will never quietly invent a price.',
      },
      {
        question: 'Can I photograph an invoice instead of uploading a PDF?',
        answer:
          'Not yet. PDF upload is the current path, straight from the email the invoice arrived in. Photo capture is on the roadmap, and the camera already handles bottle barcode scanning for stocktakes.',
      },
    ],
  },
  {
    label: 'YOUR DATA',
    items: [
      {
        question: 'Who can see what I pay my suppliers?',
        answer:
          'Nobody. Every record in Pour IQ is tied to your venue and readable by your venue alone. The only data shared across venues is a product catalogue for barcode scanning, which holds product identity only, never prices. There is no feature, screen, or report anywhere in Pour IQ that shows your prices to another venue, and none that shows them to us. We know this question matters more from us than most, because Jerry Can Spirits is itself a supplier. That is exactly why the product was built so we cannot see your buying.',
      },
      {
        question: 'Where does my data live?',
        answer:
          "On Cloudflare's infrastructure, encrypted in transit and at rest. Your original invoices are stored as the PDFs you uploaded, and you can download them again at any time.",
      },
      {
        question: 'What happens to my data if I cancel?',
        answer:
          "Your access runs to the end of the paid period. You can download your original invoice PDFs at any point before then, and a full export of your data is available on request. If you want your data deleted, ask, and we delete everything we are not legally required to keep. Purchase records fall under HMRC's six-year retention rule, so those are held to that schedule.",
      },
    ],
  },
  {
    label: 'COMPLIANCE',
    items: [
      {
        question: 'Does Pour IQ handle AWRS?',
        answer:
          "It keeps the records that matter. Every supplier invoice is archived as the original PDF alongside its extracted line data, retained in line with HMRC's six-year requirement, and retrievable when you need it. Checking that your suppliers are AWRS-registered remains your responsibility, as it does whatever tool you use.",
      },
      {
        question: 'Does it work with my accountant?',
        answer:
          "Every saved invoice can push a draft bill to Xero or QuickBooks with full line detail, your chosen expense account, and the right tax codes. No retyping. VAT returns and Making Tax Digital remain your accountant's domain; Pour IQ just makes sure the records arrive clean.",
      },
    ],
  },
  {
    label: 'GETTING STARTED',
    items: [
      {
        question: 'How long until my venue is up and running?',
        answer:
          'Your menu is loaded and analysed on day one, with the founder hands-on. Pour IQ imports a menu from pasted text, a PDF, or a spreadsheet, and ships a curated library of around 550 ingredients where you only add your own prices. Stock library and till connection are live within a fortnight.',
      },
      {
        question: 'What do I need to run it?',
        answer:
          'A browser. Nothing to install, no minimum spec worth mentioning. Everything works on a phone; a tablet is more comfortable for stocktakes but nothing requires one. The camera is used only for barcode scanning, with manual entry as a fallback.',
      },
      {
        question: 'What about the wifi in my cellar?',
        answer:
          'Pour IQ needs a connection, but every count saves the moment you enter it, ingredient by ingredient. A dropout costs you the row you were typing, never the stocktake.',
      },
    ],
  },
  {
    label: 'THE DEAL',
    items: [
      {
        question: 'What are the contract terms?',
        answer:
          'Monthly is a rolling subscription. Cancel any time, effective at the end of the paid month. Annual purchases have a fourteen-day cooling-off period with a full refund on first purchase; after that, access runs to the end of the term. No notice periods, no exit fees.',
      },
      {
        question: 'What happens to the founding rate if I leave?',
        answer:
          'It is locked for as long as you stay subscribed. Cancel and later return, and you rejoin at the going rate. A failed card payment does not cost you the rate; there is a thirty-day grace period to sort it.',
      },
      {
        question: 'Is there a limit on scanning?',
        answer:
          "A fair use one. Scanning is intended for your venue's own supplier invoices, and normal venue volumes, tens of invoices a month, are nowhere near any limit. Sustained volumes far beyond that may be throttled, and we will always talk to you first. There are no surprise bills, ever.",
      },
      {
        question: 'I run more than one venue.',
        answer:
          'Pricing is per venue, and each venue has its own login today. A group view across venues is on the roadmap. Talk to us about multi-venue arrangements at the demo.',
      },
    ],
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: groups.flatMap((group) =>
    group.items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  ),
}

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <PageHero
        label="FAQ"
        title="Straight answers."
        headingId="faq-heading"
        intro="If the answer to your question is not here, email and you will get it from the founder. No scripts, no holding pattern."
      />

      {groups.map((group) => (
        <section key={group.label} aria-label={group.label} className="py-section-y">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="font-mono text-mono-label font-medium uppercase text-slate">
              {group.label}
            </p>
            <div className="mt-4 divide-y divide-backbar border-y border-backbar">
              {group.items.map((item) => (
                <details key={item.question} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium text-chalk focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-measure [&::-webkit-details-marker]:hidden">
                    {item.question}
                    {/* Chevron rotates on open via CSS alone — no client JS. */}
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      className="h-4 w-4 shrink-0 text-slate transition-transform duration-(--pour-duration-fast) ease-pour group-open:rotate-180"
                    >
                      <path
                        d="M3 6l5 5 5-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </summary>
                  <p className="max-w-[38rem] pb-5 text-slate">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  )
}
