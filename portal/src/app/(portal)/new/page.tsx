import { redirect } from 'next/navigation'
import Link from 'next/link'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { CreateMenuForm } from '@/components/pouriq/CreateMenuForm'

export const dynamic = 'force-dynamic'

export default async function NewMenuPage() {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <Link href="/menus" className="text-sm text-slate-500 hover:text-slate-700">← All menus</Link>
        <div className="inline-block px-4 py-2 bg-slate-100 rounded-full border border-slate-200 mt-3 mb-6">
          <span className="text-slate-500 text-sm font-semibold uppercase tracking-widest">Pour IQ™</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-3">Create a new menu</h1>
        <p className="text-slate-500 text-sm mb-10">Start with the basics. You can add drinks one at a time, or use AI menu import to paste/upload an existing menu on the next screen.</p>
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <CreateMenuForm />
        </div>
      </div>
    </main>
  )
}
