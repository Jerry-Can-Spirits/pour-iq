// The keyword/description row used by the homepage "02 / THE FIX" section
// and the pricing page capability and roadmap lists. Render inside a
// `<ul className="mt-10 divide-y divide-backbar">` so the 1px backbar rules
// come from the list. Class strings are kept whole per tone so the homepage
// markup is byte-identical to the pre-extraction output.
export function CapabilityRow({
  keyword,
  description,
  keywordTone = 'measure',
}: {
  keyword: string
  description: string
  /** Roadmap rows use slate keywords — deliberately not the measure accent. */
  keywordTone?: 'measure' | 'slate'
}) {
  return (
    <li className="flex flex-col gap-2 py-5 lg:flex-row lg:items-baseline lg:gap-8">
      <span
        className={
          keywordTone === 'measure'
            ? 'font-mono text-mono-label font-medium text-measure lg:w-40 lg:shrink-0'
            : 'font-mono text-mono-label font-medium text-slate lg:w-40 lg:shrink-0'
        }
      >
        {keyword}
      </span>
      <p className="max-w-[34rem] text-chalk">{description}</p>
    </li>
  )
}
