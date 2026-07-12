import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { VoiceProfileForm } from '@/components/pouriq/VoiceProfileForm'
import { getVoiceProfile } from '@/lib/pouriq/voice-profile'

export const dynamic = 'force-dynamic'

export default async function VoiceProfileSettingsPage() {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const profile = await getVoiceProfile(db, access.tradeAccountId)

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">← Pour IQ™</Link>
        <div className="inline-block px-4 py-2 bg-slate-100 rounded-full border border-slate-200 mt-3 mb-6">
          <span className="text-slate-500 text-sm font-semibold uppercase tracking-widest">Pour IQ™ Settings</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Voice Profile</h1>
        <p className="text-slate-600 text-base leading-relaxed mb-10">
          {profile
            ? 'Edit how Pour IQ™ writes descriptions for your drinks. Updates apply to every generation from now on; existing descriptions stay as they are until you regenerate them.'
            : 'Tell Pour IQ™ how your bar sounds. The AI uses this every time it writes a description, so do it once and forget it.'}
        </p>
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <VoiceProfileForm initial={profile} />
        </div>
      </div>
    </main>
  )
}
