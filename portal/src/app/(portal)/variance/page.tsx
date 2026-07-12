import { redirect } from 'next/navigation'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { VarianceEditor } from '@/components/pouriq/VarianceEditor'

export const dynamic = 'force-dynamic'

export default async function VariancePage() {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <a href="/menus" className="text-sm text-slate-500 hover:text-slate-700">All menus</a>
      <h1 className="text-2xl font-bold text-slate-900 mt-2 mb-1">Variance</h1>
      <p className="text-sm text-slate-500 mb-6">Count each bottle on your normal weekly or monthly rhythm. We compare what the till says you poured with what you actually have left, across every cocktail and serve.</p>
      <VarianceEditor />
    </main>
  )
}
