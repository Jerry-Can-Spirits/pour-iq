import { CtaLink } from '@/components/marketing/cta-link'

export default function HomePage() {
  return (
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
  )
}
