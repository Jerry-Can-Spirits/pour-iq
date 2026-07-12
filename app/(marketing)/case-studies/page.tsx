import { CtaLink } from '@/components/marketing/cta-link'
import { PageHero } from '@/components/marketing/page-hero'
import { buildMetadata } from '@/lib/metadata'

export const metadata = buildMetadata({
  title: 'Proof',
  description:
    "Real figures from real venues, starting with Pour IQ's first pilot at The Bank Bar and Grill. Published as they land.",
  path: '/case-studies',
})

// Final approved copy (Dan, 2026-07-12). The pilot terms mirror the signed
// charter: five agreed metrics, ninety days from August 2026, and nothing
// published without The Bank's written consent.
export default function CaseStudiesPage() {
  return (
    <>
      <PageHero
        label="PROOF"
        title="Real figures from a real bar."
        headingId="proof-heading"
        intro="No composite case studies, no numbers written by marketing. What Pour IQ finds gets published here, with the venue's consent, as it lands."
      />

      <section aria-labelledby="pilot-one-heading" className="py-section-y">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mono-label font-medium uppercase text-slate">PILOT / 001</p>
          <h2
            id="pilot-one-heading"
            className="mt-4 font-display text-display font-bold text-chalk"
          >
            The Bank Bar and Grill.
          </h2>
          {/* Ledger-card treatment, as the homepage pilot card. */}
          <div className="mt-6 max-w-[42rem] rounded-lg bg-backbar p-6 sm:p-8">
            <p className="max-w-[38rem] text-slate">
              Pour IQ&apos;s first pilot runs for ninety days at The Bank Bar and Grill, beginning
              August 2026. Five things are being measured, agreed before the start: cocktail gross
              profit from day fourteen to day ninety, stock variance, the time an invoice takes to
              process against the old manual way, drink sales mix from the till, and what the team
              actually thinks of using it. When the numbers land, they are published here with The
              Bank&apos;s written consent. If a number is unflattering, it is published anyway. That
              is the point of this page.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="pilot-two-heading" className="py-section-y">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mono-label font-medium uppercase text-slate">PILOT / 002</p>
          <h2
            id="pilot-two-heading"
            className="mt-4 font-display text-display font-bold text-chalk"
          >
            Your venue.
          </h2>
          <p className="mt-6 max-w-[38rem] text-slate">
            The second pilot slot is open, and the first ten venues take the founding rate with
            them. Twenty minutes, a working demo venue, and your own numbers from week one.
          </p>
        </div>
      </section>

      {/* Full-bleed backbar closing band, as the homepage and about pages. */}
      <section className="bg-backbar py-section-y">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <CtaLink href="/contact">Book a demo</CtaLink>
          </div>
        </div>
      </section>
    </>
  )
}
