import { CapabilityRow } from '@/components/marketing/capability-row'
import { CtaLink } from '@/components/marketing/cta-link'
import { buildMetadata } from '@/lib/metadata'
import { annualAtMonthlyRate, formatPrice, foundingAnnualRate, pricing } from '@/lib/pricing'

export const metadata = buildMetadata({
  title: 'Pricing',
  description:
    'One monthly price, no contract, cancel any time. See what Pour IQ costs and what a venue loses each month without it.',
  path: '/pricing',
})

// Final approved copy. Every figure renders from lib/pricing.ts — no price
// literals in this file. All seven capability rows are code-verified shipped
// features (capability inventory, 2026-07-11); BENCHMARK and PHOTO are
// roadmap items and stay in the roadmap section with slate keywords.
const planCards = [
  {
    label: 'MONTHLY',
    price: pricing.monthly,
    period: 'per venue, per month',
    copy: 'No contract. Cancel any time. Every capability included.',
    founding: false,
  },
  {
    label: 'ANNUAL',
    price: pricing.annual,
    period: 'per venue, per year',
    copy: 'Two months free. Otherwise identical.',
    founding: false,
  },
  {
    label: 'FOUNDING / FIRST TEN VENUES',
    price: pricing.founding,
    period: 'per venue, per month',
    copy: 'Locked at this rate for as long as you stay subscribed.',
    founding: true,
  },
]

const capabilities = [
  {
    keyword: 'SCAN',
    description:
      'Upload a supplier invoice, straight from the email it arrived in. Pour IQ reads every line, logs every price, and flags what moved since last time.',
  },
  {
    keyword: 'RIPPLE',
    description:
      'One price rise touches every recipe it appears in. See the hit to each serve, and to the menu as a whole, the moment it lands.',
  },
  {
    keyword: 'COST',
    description:
      'Every spec on your menu, costed to the penny and kept current. Built on the Jerry Can Spirits Field Manual recipe library.',
  },
  {
    keyword: 'ENGINEER',
    description:
      'Every item on the menu, plotted by what it sells against what it makes. Know what to push, what to re-price, and what to drop.',
  },
  {
    keyword: 'COUNT',
    description:
      'Stocktakes that show variance in millilitres, percent, and pounds, with a reason logged against every gap.',
  },
  {
    keyword: 'CONNECT',
    description: 'Square, Zettle, and SumUp sales in. Xero and QuickBooks bills out. No retyping.',
  },
  {
    keyword: 'VOICE',
    description:
      "Menu descriptions written in your venue's voice, not a template's. No other platform does this.",
  },
]

const roadmap = [
  {
    keyword: 'BENCHMARK',
    description:
      'See how your supplier prices sit against venues like yours. Anonymous in both directions.',
  },
  {
    keyword: 'PHOTO',
    description:
      'Photograph an invoice instead of uploading it. The camera already handles barcode scanning; invoices are next.',
  },
]

export default function PricingPage() {
  return (
    <>
      <section aria-labelledby="pricing-heading" className="py-section-y">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mono-label font-medium uppercase text-slate">PRICING</p>
          <h1
            id="pricing-heading"
            className="mt-4 max-w-4xl font-display text-display-xl font-extrabold text-chalk"
          >
            One price. No contract. Nothing hidden.
          </h1>
          <p className="mt-6 max-w-[34rem] text-slate">
            Pour IQ is {formatPrice(pricing.monthly)} a month plus VAT, per venue. Cancel any time.
            The first ten venues get the founding rate instead.
          </p>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {planCards.map((card) => (
              <div
                key={card.label}
                className={
                  card.founding
                    ? 'rounded-lg border border-measure bg-backbar p-6 sm:p-8'
                    : 'rounded-lg bg-backbar p-6 sm:p-8'
                }
              >
                <p className="font-mono text-mono-label font-medium uppercase text-slate">
                  {card.label}
                </p>
                <p className="mt-6 font-mono text-display font-medium text-chalk">
                  {formatPrice(card.price)}{' '}
                  <span className="text-small text-slate">{pricing.vat}</span>
                </p>
                <p className="mt-1 text-small text-slate">{card.period}</p>
                <p className="mt-6 text-slate">{card.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="maths-heading" className="py-section-y">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mono-label font-medium uppercase text-slate">THE MATHS</p>
          <h2 id="maths-heading" className="mt-4 font-display text-display font-bold text-chalk">
            Price it against the leak.
          </h2>
          <p className="mt-6 max-w-[38rem] text-slate">
            The worked example on our homepage loses{' '}
            <span className="font-mono text-chalk">£915</span> a year on one drink, on one line of
            the menu. Most menus run to dozens of lines. Pour IQ costs{' '}
            <span className="font-mono text-chalk">{formatPrice(annualAtMonthlyRate)}</span> a year,{' '}
            <span className="font-mono text-chalk">{formatPrice(foundingAnnualRate)}</span> at the
            founding rate, and shows you every line at once.
          </p>
        </div>
      </section>

      <section aria-labelledby="included-heading" className="py-section-y">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mono-label font-medium uppercase text-slate">WHAT YOU GET</p>
          <h2 id="included-heading" className="mt-4 font-display text-display font-bold text-chalk">
            Everything, on every plan.
          </h2>
          <ul className="mt-10 divide-y divide-backbar">
            {capabilities.map((capability) => (
              <CapabilityRow
                key={capability.keyword}
                keyword={capability.keyword}
                description={capability.description}
              />
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="roadmap-heading" className="py-section-y">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mono-label font-medium uppercase text-slate">
            ON THE ROADMAP
          </p>
          <h2 id="roadmap-heading" className="mt-4 font-display text-display font-bold text-chalk">
            Coming, not claimed.
          </h2>
          <p className="mt-6 max-w-[38rem] text-slate">
            We only sell what is built. These are in development.
          </p>
          <ul className="mt-10 divide-y divide-backbar">
            {roadmap.map((item) => (
              <CapabilityRow
                key={item.keyword}
                keyword={item.keyword}
                description={item.description}
                keywordTone="slate"
              />
            ))}
          </ul>
        </div>
      </section>

      {/* Full-bleed backbar band matching the homepage 04 treatment; slate on
          backbar is 6.05:1, AA at all sizes (verified 2026-07-11). */}
      <section aria-labelledby="demo-heading" className="bg-backbar py-section-y">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 id="demo-heading" className="font-display text-display font-bold text-chalk">
            Twenty minutes, then your call.
          </h2>
          <p className="mt-6 max-w-[34rem] text-slate">
            Book a demo, see the working venue, and decide. If it is not for you, you have lost
            twenty minutes.
          </p>
          <div className="mt-10">
            <CtaLink href="/contact">Book a demo</CtaLink>
          </div>
        </div>
      </section>
    </>
  )
}
