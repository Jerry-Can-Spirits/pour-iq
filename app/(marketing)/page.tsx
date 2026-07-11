import { CtaLink } from '@/components/marketing/cta-link'

const capabilities = [
  {
    keyword: 'SCAN',
    description:
      'Take a photo of a supplier invoice. Pour IQ reads every line, logs every price, and flags what moved since last time.',
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
      'Till sales set against the margin on every spec. Pour IQ shows which drinks to push, which to re-engineer, and which to drop.',
  },
  {
    keyword: 'COUNT',
    description:
      'Stocktakes measured against what the till says should have gone. The gap shows up in millilitres, percent, and pounds, with a reason logged against every loss.',
  },
  {
    keyword: 'CONNECT',
    description:
      'Square, Zettle, and SumUp feed sales straight in. Xero and QuickBooks take the bills at the other end. No retyping on either side.',
  },
  {
    keyword: 'VOICE',
    description:
      'Drink descriptions drafted in your venue’s own voice, from a profile you set once. Every line can be kept, edited, or binned before it goes near a menu.',
  },
]

const ledgerRows = [
  { description: 'House gin and tonic, menu price', figure: '£8.50' },
  { description: 'Pour cost when the menu was priced', figure: '£1.87' },
  { description: 'Pour cost after two supplier rises', figure: '£2.31' },
]

export default function HomePage() {
  return (
    <>
      <section
        aria-labelledby="hero-heading"
        className="flex min-h-[85svh] items-center py-section-y"
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mono-label font-medium uppercase text-slate">
            NOW IN PILOT AT THE BANK BAR AND GRILL
          </p>
          <h1
            id="hero-heading"
            className="mt-4 max-w-4xl font-display text-display-xl font-extrabold text-chalk"
          >
            Your margin is leaking. Pour IQ shows you{' '}
            <span className="pour-underline">exactly where</span>.
          </h1>
          <p className="mt-6 max-w-[34rem] text-slate">
            Pour IQ scans your supplier invoices, costs every serve, and shows what each price rise
            does to your GP. Built for independent UK bars.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <CtaLink href="/contact">Book a demo</CtaLink>
            <a
              href="#the-leak"
              className="font-medium text-chalk decoration-measure decoration-2 underline-offset-4 hover:underline"
            >
              How it works
            </a>
          </div>
        </div>
      </section>

      {/* scroll-mt clears the sticky header when the hero anchor resolves here. */}
      <section id="the-leak" aria-labelledby="leak-heading" className="scroll-mt-16 py-section-y">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="font-mono text-mono-label font-medium uppercase text-slate">
                01 / THE LEAK
              </p>
              <h2 id="leak-heading" className="mt-4 font-display text-display font-bold text-chalk">
                You know your GP on paper. The bar pours something else.
              </h2>
              <p className="mt-6 max-w-[38rem] text-slate">
                Somewhere between the plan and the till, margin goes missing. A supplier puts 4% on
                a case and the menu price never moves. A spec drifts by a quarter measure. A
                stocktake says fine when it is not fine. None of it shows up as one big number. It
                shows up as pennies, on every serve, every night.
              </p>
            </div>
            <div className="max-w-[28rem] rounded-lg bg-backbar p-6 sm:p-8">
              <p className="font-mono text-mono-label font-medium uppercase text-slate">
                WORKED EXAMPLE / ONE SERVE
              </p>
              <dl className="mt-6 flex flex-col gap-3">
                {ledgerRows.map((row) => (
                  <div key={row.description} className="flex items-baseline justify-between gap-4">
                    <dt className="text-small text-slate">{row.description}</dt>
                    <dd className="text-right font-mono text-small text-chalk">{row.figure}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-4 border-t border-cellar pt-3">
                  <dt className="text-small text-chalk">Gone, every serve</dt>
                  <dd className="text-right font-mono text-heading font-medium text-leak">
                    −£0.44
                  </dd>
                </div>
              </dl>
              <p className="mt-6 text-small text-slate">
                Forty of those a week is <span className="font-mono text-chalk">£915</span> a year.
                On one drink, on one line of the menu.
              </p>
            </div>
          </div>
          <p className="mt-10 text-chalk">
            Pour IQ was built to make that visible before the month is gone.
          </p>
        </div>
      </section>

      <section id="the-fix" aria-labelledby="fix-heading" className="scroll-mt-16 py-section-y">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mono-label font-medium uppercase text-slate">02 / THE FIX</p>
          <h2 id="fix-heading" className="mt-4 font-display text-display font-bold text-chalk">
            Photograph the invoice. Pour IQ does the rest.
          </h2>
          <p className="mt-6 max-w-[38rem] text-slate">
            No spreadsheets to keep alive, no data entry at midnight. The work starts from the
            paperwork you already have in your hand.
          </p>
          <ul className="mt-10 divide-y divide-backbar">
            {capabilities.map((capability) => (
              <li
                key={capability.keyword}
                className="flex flex-col gap-2 py-5 lg:flex-row lg:items-baseline lg:gap-8"
              >
                <span className="font-mono text-mono-label font-medium text-measure lg:w-40 lg:shrink-0">
                  {capability.keyword}
                </span>
                <p className="max-w-[34rem] text-chalk">{capability.description}</p>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-chalk">
            Ten minutes after the delivery lands, you know where you stand.
          </p>
        </div>
      </section>
    </>
  )
}
