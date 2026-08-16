import { redirect } from 'next/navigation'
import Link from 'next/link'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { LicenceGate } from '@/components/pouriq/LicenceGate'

export const dynamic = 'force-dynamic'

// The JCS-era help content lived in the Jerry Can Spirits Sanity project and
// stayed behind in the entity split. Until Pour IQ has its own docs source,
// help is the direct line — which is the product promise anyway.
export default async function PourIqHelpPage() {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← Pour IQ®
        </Link>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mt-3 mb-3">Pour IQ® help</h1>
        <div className="bg-white rounded-xl p-8 border border-slate-200">
          <p className="text-slate-600 leading-relaxed">
            Your problem lands with the person who built the thing. Email{' '}
            <a
              href="mailto:dan@jerrycanspirits.co.uk"
              className="font-medium text-emerald-700 hover:text-emerald-800"
            >
              dan@jerrycanspirits.co.uk
            </a>{' '}
            and you will hear back within one working day — same day if it affects live service.
          </p>
        </div>
      </div>
    </main>
  )
}
