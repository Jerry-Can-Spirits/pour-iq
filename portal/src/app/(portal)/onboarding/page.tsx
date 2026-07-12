import type { Metadata } from 'next'
import { requireTradeSession } from '@/lib/trade-portal/session-check'
import { TradeSheetSection, TradeSheetShell } from '@/components/trade-portal/TradeSheetShell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pour IQ™ Quickstart',
  robots: { index: false, follow: false },
}

export default async function PourIqOnboardingPage() {
  await requireTradeSession()

  return (
    <TradeSheetShell
      title="Your first session"
      eyebrow="Pour IQ™ Quickstart"
      subtitle="Thirty minutes to set up and import your first menu"
      tone="light"
    >
      <p className="text-base leading-relaxed mb-6">
        Welcome to Pour IQ™. This sheet covers your first thirty minutes. Sign in, set your Voice Profile, import your first menu. Everything else comes after.
      </p>

      <TradeSheetSection title="1. Sign in (1 min)">
        <p className="text-sm leading-relaxed">
          Open <span className="font-mono">jerrycanspirits.co.uk/login</span> and enter the PIN we gave you. You&apos;ll land on the Trade Hub. Click the Pour IQ™ tile.
        </p>
      </TradeSheetSection>

      <TradeSheetSection title="2. Set your Voice Profile (5 min)">
        <p className="text-sm leading-relaxed mb-3">
          Voice Profile is how Pour IQ™ writes drink descriptions in your bar&apos;s voice. Set it once and forget it.
        </p>
        <ul className="list-disc list-outside ml-5 text-sm leading-relaxed space-y-1.5 mb-3">
          <li>Click Voice Profile in the Pour IQ™ menu.</li>
          <li>Choose tone, person, length, and hard rules.</li>
          <li>Paste one to three sample descriptions you like the cadence of. Yours, a competitor&apos;s, anything.</li>
          <li>Add specific brand facts in the &quot;anything else&quot; box.</li>
          <li>Save.</li>
        </ul>
        <p className="text-sm leading-relaxed italic">
          The samples do the heaviest lifting. Concrete examples beat abstract descriptors every time.
        </p>
      </TradeSheetSection>

      <TradeSheetSection title="3. Import your first menu (10 min)">
        <p className="text-sm leading-relaxed mb-3">
          Pour IQ™ accepts pasted text, PDF, or spreadsheet.
        </p>
        <ul className="list-disc list-outside ml-5 text-sm leading-relaxed space-y-1.5 mb-3">
          <li>From the Pour IQ™ dashboard, click &quot;Add menu&quot;.</li>
          <li>Pick a method. PDF is usually fastest if you have one.</li>
          <li>Drop the file. Claude reads it and pulls out every cocktail.</li>
          <li>Review the proposed recipes. Fix anything wrong: a measure, an ingredient, a name. Pour IQ™ will remember your edits.</li>
          <li>Confirm to save.</li>
        </ul>
        <p className="text-sm leading-relaxed">
          If your menu uses house names without ingredients listed, you&apos;ll need to add a few recipes manually. There&apos;s a button for that.
        </p>
      </TradeSheetSection>

      <TradeSheetSection title="4. Look at the analysis (10 min)">
        <p className="text-sm leading-relaxed mb-3">
          Once the menu&apos;s in, Pour IQ™ shows you the maths for every drink.
        </p>
        <ul className="list-disc list-outside ml-5 text-sm leading-relaxed space-y-1.5 mb-3">
          <li>GP% per drink, inc-VAT or net (your choice).</li>
          <li>Average GP% across the menu.</li>
          <li>Ingredients reused across drinks (low waste risk) versus single-use (high waste risk).</li>
          <li>AI recommendations in plain English.</li>
        </ul>
        <p className="text-sm leading-relaxed">
          Read it. Don&apos;t act on anything yet. Get a feel for what the platform sees in your menu before deciding what to change.
        </p>
      </TradeSheetSection>

      <TradeSheetSection title="5. Print spec cards (4 min)">
        <p className="text-sm leading-relaxed">
          On the menu page, click &quot;Spec cards&quot; in the header. Each drink prints as a one-page bar reference: name, glass, garnish, ingredients with measures, method. Laminate them and hand them to staff.
        </p>
      </TradeSheetSection>

      <TradeSheetSection title="Next session">
        <ul className="list-disc list-outside ml-5 text-sm leading-relaxed space-y-2 mb-3">
          <li>
            <span className="font-semibold">Variance.</span> Weekly stock counts. Theoretical versus actual usage, surfaced as ml, percent, and pounds.
          </li>
          <li>
            <span className="font-semibold">Invoice scanning.</span> Drop a supplier PDF. Pour IQ™ extracts every line and updates costs across every drink that uses those ingredients.
          </li>
          <li>
            <span className="font-semibold">Brand-voiced menu copy.</span> Generate customer-facing descriptions from your Voice Profile and hand them straight to your designer.
          </li>
        </ul>
        <p className="text-sm leading-relaxed">
          Try one feature per week. Don&apos;t try everything at once.
        </p>
      </TradeSheetSection>

      <TradeSheetSection title="Help">
        <ul className="list-disc list-outside ml-5 text-sm leading-relaxed space-y-1.5">
          <li>
            In-app help guide: <span className="font-mono">/help</span>. One section per feature.
          </li>
          <li>
            Direct: <span className="font-mono">dan@jerrycanspirits.co.uk</span>, or call. We&apos;re the founders. We built it, we&apos;ll fix it.
          </li>
        </ul>
      </TradeSheetSection>
    </TradeSheetShell>
  )
}
