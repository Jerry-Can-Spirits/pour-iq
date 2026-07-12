import Link from 'next/link'
import { CtaLink } from '@/components/marketing/cta-link'
import { FounderPhoto } from '@/components/marketing/founder-photo'
import { buildMetadata } from '@/lib/metadata'

export const metadata = buildMetadata({
  title: 'About Dan Freeman',
  description:
    'Twelve years in the Royal Corps of Signals, a spirits brand sold venue by venue, and Pour IQ, built from watching good bars lose margin they could not see.',
  ogDescription:
    'Twelve years in the Royal Corps of Signals, then a tool built from watching good bars lose margin they could not see.',
  path: '/about',
})

// Final approved copy (Dan, 2026-07-12; "Dan" rather than "Dan Freeman"
// throughout, per instruction).
const sections = [
  {
    label: '01 / THE SIGNALS',
    heading: 'Twelve years of making systems work for the people using them.',
    id: 'signals-heading',
    body: 'Dan served twelve years in the Royal Corps of Signals, first as a communications systems operator, then retrading as an IS Engineer, running service desks across large multinational deployments. The military runs on good process wrapped in overengineered software, tools that do the job only after three workarounds and a form nobody understands. Dan spent his career on the other side of that: redesigning the forms so they made sense to the people filling them in, rebuilding how teams responded to incidents so the process served the work. The habit stuck. Design for the person actually using the thing, or do not bother.',
  },
  {
    label: '02 / THE ROUNDS',
    heading: 'The education of selling rum, venue by venue.',
    id: 'rounds-heading',
    body: 'After the Army, Dan co-founded Jerry Can Spirits and took Expedition Spiced Rum into the on-trade the only way an independent can: walking in, talking to the bar team, then finding whoever holds the purchasing budget. Do that enough times and every conversation lands in the same place. Money. Venues tied to distributors with no freedom to buy independently. Budgets with no room for anything beyond the big brands. Managers spending hours behind a spreadsheet when they should be running the bar, working across five systems that do not talk to each other: the POS, the accounts, the menus, the invoices, the stocktake. Pour IQ started as a list of those conversations. It became the tool that puts them on one screen.',
  },
  {
    label: '03 / THE STAKES',
    heading: 'What gets lost when an independent closes.',
    id: 'stakes-heading',
    body: 'Bars are closing across the country, and the village pubs and tucked-away locals go first. Every one that shuts is a community hub gone and, often, a historic building left to rot. It is also the end of a place that would give a craft spirit or a small brewery a chance, because it is the independents that take those chances. Pour IQ exists to catch the leaks early, while they are still pennies per serve, before they become the reason another set of doors does not open.',
  },
  {
    label: '04 / THE PROMISE',
    heading: 'When you email, you get me.',
    id: 'promise-heading',
    body: 'Pour IQ has no staff yet, and that is a feature for now. Your problem lands with the person who built the thing. If it affects other venues, it gets fixed for everyone. If it is particular to yours, it gets fixed for you. That is the arrangement, and it holds until the day it can be replaced with something equally direct.',
  },
]

export default function AboutPage() {
  return (
    <>
      <section aria-labelledby="about-heading" className="py-section-y">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
            <div>
              <p className="font-mono text-mono-label font-medium uppercase text-slate">ABOUT</p>
              <h1
                id="about-heading"
                className="mt-4 max-w-4xl font-display text-display-xl font-extrabold text-chalk"
              >
                Built by the person who answers the phone.
              </h1>
              <p className="mt-6 max-w-[38rem] text-slate">
                Pour IQ has no sales team, no account managers, and no support tiers. There is Dan,
                who built it, sells the rum, and picks up when you call. This page is who you would
                be dealing with.
              </p>
            </div>
            <FounderPhoto />
          </div>
        </div>
      </section>

      {sections.map((section) => (
        <section key={section.id} aria-labelledby={section.id} className="py-section-y">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="font-mono text-mono-label font-medium uppercase text-slate">
              {section.label}
            </p>
            <h2 id={section.id} className="mt-4 font-display text-display font-bold text-chalk">
              {section.heading}
            </h2>
            <p className="mt-6 max-w-[38rem] text-slate">{section.body}</p>
          </div>
        </section>
      ))}

      {/* Full-bleed backbar band, as the homepage and pricing closers. No
          heading: the 04 promise is the close, the band carries only the
          CTA row. Slate/chalk on backbar verified AA (2026-07-11). */}
      <section className="bg-backbar py-section-y">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <CtaLink href="/contact">Book a demo</CtaLink>
            <Link
              href="/pricing"
              className="font-medium text-chalk decoration-measure decoration-2 underline-offset-4 hover:underline"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
