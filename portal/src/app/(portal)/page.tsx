import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess, requireDemoSession } from '@/lib/pouriq/access'
import { readDemoOverlay } from '@/lib/pouriq/demo/overlay'
import { DemoScanRipple } from '@/components/pouriq/demo/DemoScanRipple'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { loadDashboard, loadSetupProgress } from '@/lib/pouriq/dashboard'
import { SECONDARY_BUTTON_SM } from '@/lib/pouriq/button-styles'
import { PAGE_TITLE, SECTION_LABEL, statusText } from '@/lib/pouriq/ui'

export const dynamic = 'force-dynamic'

function money(p: number): string {
  return `£${(p / 100).toFixed(2)}`
}

export default async function TodayDashboard() {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const [{ attention, sales, profitability }, setup] = await Promise.all([
    loadDashboard(db, access.tradeAccountId),
    loadSetupProgress(db, access.tradeAccountId),
  ])

  // Demo: the scan-ripple headline moment, above everything else. Its
  // applied state is read from the session overlay so it survives a reload.
  let demoRippleApplied = false
  if (access.role === 'demo') {
    const kv = env.SITE_OPS as KVNamespace
    const sid = await requireDemoSession()
    if (sid) demoRippleApplied = (await readDemoOverlay(kv, sid)).rippleApplied === true
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <h1 className={`${PAGE_TITLE} mb-8`}>Today</h1>

        {access.role === 'demo' && <DemoScanRipple initiallyApplied={demoRippleApplied} />}

        {!setup.allComplete && (
          <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Pour IQ setup</h2>
              <span className="text-xs text-slate-500">{setup.completeCount} of {setup.total} complete</span>
            </div>
            <ul className="space-y-1.5 text-sm">
              {setup.steps.map((step) => (
                <li key={step.key}>
                  {step.done ? (
                    <span className="text-slate-500"><span aria-hidden className="text-emerald-600">✓</span> {step.label}</span>
                  ) : (
                    <Link href={step.href} className="text-emerald-700 hover:text-emerald-800"><span aria-hidden>○ </span>{step.label}<span aria-hidden> →</span></Link>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
              New to Pour IQ? <Link href="/onboarding" className="text-emerald-700 hover:text-emerald-800">Read the quickstart guide →</Link>
            </p>
          </section>
        )}

        <section className="mb-8">
          <h2 className={`${SECTION_LABEL} mb-3`}>Attention required</h2>
          {attention.length === 0 ? (
            <p className="text-sm text-slate-500 rounded-xl border border-slate-200 bg-white p-4">
              Nothing needs attention right now.
            </p>
          ) : (
            <ul className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-200">
              {attention.map((row) => (
                <li key={row.key}>
                  <Link href={row.href} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-100 transition-colors">
                    <span aria-hidden className={row.severity === 'high' ? statusText('bad') : statusText('watch')}>●</span>
                    <span className="flex-1 text-sm text-slate-900">{row.label}</span>
                    <span className={`text-[11px] rounded-full px-2 py-0.5 border whitespace-nowrap ${row.severity === 'high' ? 'text-rose-600 border-rose-300' : 'text-amber-600 border-amber-300'}`}>
                      {row.severity === 'high' ? 'High' : 'Medium'}
                    </span>
                    <span aria-hidden className="text-emerald-700">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-8 grid sm:grid-cols-2 gap-4">
          {sales && profitability ? (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className={`${SECTION_LABEL} mb-2`}>Sales this period</h2>
                <p className="text-2xl font-bold text-slate-900">{money(sales.revenue_p)}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {sales.serves} {sales.serves === 1 ? 'serve' : 'serves'}
                  {sales.top.length > 0 && ` · top: ${sales.top.map((t) => t.name).join(', ')}`}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className={`${SECTION_LABEL} mb-2`}>Menu profitability</h2>
                <p className="text-2xl font-bold text-emerald-600">
                  {profitability.headline_gp_pct.toFixed(0)}% <span className="text-xs font-normal text-slate-500">GP ({profitability.headline_basis})</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {profitability.below_target === 0 && profitability.incomplete === 0
                    ? 'All drinks costed and on target'
                    : [
                        profitability.below_target > 0 ? `${profitability.below_target} below target` : null,
                        profitability.incomplete > 0 ? `${profitability.incomplete} missing cost` : null,
                      ].filter(Boolean).join(' · ')}
                </p>
              </div>
            </>
          ) : (
            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              Set an active menu and connect your till to see sales and profitability.{' '}
              <Link href="/menus" className="text-emerald-700 hover:text-emerald-800 underline">Your menus →</Link>
            </div>
          )}
        </section>

        <section>
          <h2 className={`${SECTION_LABEL} mb-3`}>Quick actions</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/stock" className={SECONDARY_BUTTON_SM}>Start stock count</Link>
            <Link href="/invoices/new" className={SECONDARY_BUTTON_SM}>Scan invoice</Link>
            <Link href="/new" className="text-sm text-emerald-700 hover:text-emerald-800 underline">Import menu</Link>
            <Link href="/variance" className="text-sm text-emerald-700 hover:text-emerald-800 underline">Check variance</Link>
            <Link href="/library" className="text-sm text-emerald-700 hover:text-emerald-800 underline">Search ingredients</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
