import { PageHero } from '@/components/marketing/page-hero'
import { DemoForm } from '@/components/marketing/demo-form'
import { contactCopy } from '@/lib/contact-copy'
import { buildMetadata } from '@/lib/metadata'

export const metadata = buildMetadata({
  title: 'Book a demo',
  description:
    'Book a Pour IQ demo for your venue. Built by Jerry Can Spirits for independent UK bars.',
  path: '/contact',
})

export default function ContactPage() {
  return (
    <>
      <PageHero
        label={contactCopy.heroLabel}
        title={contactCopy.heroTitle}
        headingId="contact-heading"
        intro={contactCopy.heroIntro}
      />
      <section aria-label="Demo booking form" className="pb-section-y">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <DemoForm />
          <p className="mt-10 max-w-[38rem] text-small text-slate">
            {contactCopy.emailAlternative.before}
            <a
              href={`mailto:${contactCopy.emailAlternative.address}`}
              className="text-chalk underline decoration-measure decoration-2 underline-offset-4"
            >
              {contactCopy.emailAlternative.address}
            </a>
            {contactCopy.emailAlternative.after}
          </p>
        </div>
      </section>
    </>
  )
}
