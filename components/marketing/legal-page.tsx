import { PageHero } from '@/components/marketing/page-hero'
import { formatLegalDate } from '@/lib/legal'

export interface LegalSection {
  num: string
  title: string
  /** Paragraphs, rendered in order. Sub-clauses (a)-(d) are their own
   *  paragraphs, as they appear in the approved copy — not bullet lists. */
  paras: React.ReactNode[]
}

// Shared scaffold for the two legal documents: PageHero, numbered h2
// sections (number in mono measure), slate body at max-w-[42rem], and the
// last-updated line rendered from lib/legal.ts below a backbar rule.
export function LegalPage({
  title,
  headingId,
  sections,
  lastUpdated,
}: {
  title: string
  headingId: string
  sections: LegalSection[]
  lastUpdated: string
}) {
  return (
    <>
      <PageHero label="LEGAL" title={title} headingId={headingId} />
      <section aria-label="Document" className="pb-section-y">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          {sections.map((section) => (
            <div key={section.num} className="mt-12 first:mt-0">
              <h2 className="font-display text-display font-bold text-chalk">
                <span className="mr-3 font-mono text-mono-label font-medium text-measure">
                  {section.num}
                </span>
                {section.title}
              </h2>
              {section.paras.map((para, i) => (
                <p key={i} className="mt-4 max-w-[42rem] text-slate">
                  {para}
                </p>
              ))}
            </div>
          ))}
          <div className="mt-16 border-t border-backbar pt-6">
            <p className="text-small text-slate">
              Last updated{' '}
              <span className="font-mono text-chalk">{formatLegalDate(lastUpdated)}</span>
            </p>
          </div>
        </div>
      </section>
    </>
  )
}

export function LegalMailto() {
  return (
    <a
      href="mailto:legal@jerrycanspirits.co.uk"
      className="text-chalk decoration-measure decoration-2 underline-offset-4 hover:underline"
    >
      legal@jerrycanspirits.co.uk
    </a>
  )
}
