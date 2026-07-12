// The standard page hero: mono label, display-xl h1, slate intro. Shared
// by the FAQ and proof pages; matches the markup pattern the about and
// pricing heroes established.
export function PageHero({
  label,
  title,
  headingId,
  intro,
}: {
  label: string
  title: string
  headingId: string
  intro?: string
}) {
  return (
    <section aria-labelledby={headingId} className="py-section-y">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="font-mono text-mono-label font-medium uppercase text-slate">{label}</p>
        <h1
          id={headingId}
          className="mt-4 max-w-4xl font-display text-display-xl font-extrabold text-chalk"
        >
          {title}
        </h1>
        {intro && <p className="mt-6 max-w-[38rem] text-slate">{intro}</p>}
      </div>
    </section>
  )
}
