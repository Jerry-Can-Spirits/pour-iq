import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { loadVarianceDetail } from '@/lib/pouriq/variance-detail-loader'
import { VarianceReasonControl } from '@/components/pouriq/VarianceReasonControl'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ ingredientId: string }> }

function fmt(n: number): string { return n.toFixed(1) }

function LedgerRow({ label, value, tone, bold }: { label: string; value: string; tone?: 'good' | 'warn'; bold?: boolean }) {
  const labelClass = tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-600'
  const valueClass = bold ? 'text-slate-900 font-bold' : tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-900'
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''}`}>
      <span className={labelClass}>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  )
}

export default async function VarianceDetailPage({ params }: Props) {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { ingredientId } = await params
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const d = await loadVarianceDetail(db, access.tradeAccountId, ingredientId)

  const back = <Link href="/variance" className="text-sm text-slate-500 hover:text-slate-700">← Variance</Link>

  if (!d) {
    return <main className="mx-auto max-w-3xl px-4 py-8">{back}<p className="text-slate-600 mt-4">Ingredient not found.</p></main>
  }
  if (!d.window || !d.ledger) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        {back}
        <h1 className="text-2xl font-bold text-slate-900 mt-2 mb-1">{d.name}</h1>
        <p className="text-slate-600 mt-4">Two stock counts are needed to show variance for this ingredient.</p>
      </main>
    )
  }

  const L = d.ledger
  const isProduce = d.base_unit !== 'ml'
  const countLabel = isProduce ? d.base_unit : 'bottles'
  const isLoss = L.variance_bottles > 0
  const checks: string[] = [
    'Confirm the drinks using this are mapped to the right till products',
    ...(d.per_drink.length > 0
      ? [isProduce
          ? `Review the recipe amounts for ${d.per_drink.slice(0, 2).map((x) => x.name).join(' and ')}`
          : `Review the pour size for ${d.per_drink.slice(0, 2).map((x) => x.name).join(' and ')}`]
      : []),
    'Check whether complimentary drinks were recorded',
    isProduce ? 'Verify any stock transfers to another bar or event' : 'Verify any bottle transfers to another bar or event',
    isProduce ? 'Recount remaining stock carefully' : 'Recount open bottles using measured partials',
  ]

  // Per-serve label for produce ("25ml juice", "1 wheel")
  function perServeLabel(pourMl: number, recipeUnit?: string, useName?: string): string {
    if (!useName) return `${pourMl}ml`
    const name = useName.toLowerCase()
    if (recipeUnit === 'count') return `${pourMl} ${name}`
    if (recipeUnit === 'g') return `${pourMl}g ${name}`
    return `${pourMl}ml ${name}`
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {back}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {d.name}{' '}
            <span className="text-sm font-normal text-slate-500">
              · {d.pack_size}{isProduce ? ` ${d.base_unit}` : 'ml'}
            </span>
          </h1>
          <p className="text-sm text-slate-500">
            {d.window.opening_at.slice(0, 10)} → {d.window.closing_at.slice(0, 10)}{isLoss ? ' · more usage than expected' : ''}
          </p>
        </div>
        <div className="text-right rounded-lg border border-slate-200 p-3">
          <div className="text-xs uppercase tracking-widest text-slate-500">Unexplained variance</div>
          <div className={`text-xl font-bold ${d.severity === 'red' ? 'text-rose-600' : d.severity === 'amber' ? 'text-amber-600' : 'text-slate-900'}`}>
            {fmt(Math.abs(L.variance_bottles))} {countLabel}
          </div>
          <div className="text-xs text-slate-500">
            {isProduce
              ? (d.variance_cost_p !== null ? `£${(Math.abs(d.variance_cost_p) / 100).toFixed(2)}` : '')
              : `${Math.round(Math.abs(L.variance_bottles) * d.pack_size)}ml${d.variance_cost_p !== null ? ` · £${(Math.abs(d.variance_cost_p) / 100).toFixed(2)}` : ''}`}
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-2">How this was calculated</h2>
        <div className="rounded-lg border border-slate-200 p-4 text-sm max-w-md space-y-1">
          <LedgerRow label={`Opening count (${d.window.opening_at.slice(0, 10)})`} value={fmt(L.opening_bottles)} />
          <LedgerRow label={`+ Deliveries (${d.deliveries_count})`} value={`+ ${fmt(L.deliveries_bottles)}`} tone="good" />
          {L.produced_bottles !== 0 && <LedgerRow label="+ Produced" value={`+ ${fmt(L.produced_bottles)}`} tone="good" />}
          {L.consumed_bottles !== 0 && <LedgerRow label="− Consumed (batches)" value={`− ${fmt(L.consumed_bottles)}`} />}
          <LedgerRow label="− Expected usage (sales × recipe)" value={`− ${fmt(L.expected_usage_bottles)}`} tone="warn" />
          <div className="border-t border-slate-200 my-1" />
          <LedgerRow label="= Expected closing" value={fmt(L.expected_closing_bottles)} />
          <LedgerRow label={`Actual count (${d.window.closing_at.slice(0, 10)})`} value={fmt(L.actual_closing_bottles)} />
          <div className="border-t border-slate-200 my-1" />
          <LedgerRow label="⇒ Unexplained variance" value={`${fmt(L.variance_bottles)} ${countLabel}`} bold />
        </div>
      </section>

      {d.per_drink.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-2">Expected usage by drink</h2>
          <table className="w-full text-sm max-w-md">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-1">Drink</th>
                <th className="py-1 text-right">Serves</th>
                <th className="py-1 text-right">{isProduce ? 'Per serve' : 'Pour'}</th>
                <th className="py-1 text-right">Usage</th>
              </tr>
            </thead>
            <tbody>
              {d.per_drink.map((x) => (
                <tr key={x.name} className="border-b border-slate-100">
                  <td className="py-1 text-slate-900">{x.name}</td>
                  <td className="py-1 text-right text-slate-600">{x.units}</td>
                  {isProduce ? (
                    <>
                      <td className="py-1 text-right text-slate-600">{perServeLabel(x.pour_ml, x.recipe_unit, x.use_name)}</td>
                      <td className="py-1 text-right text-slate-700">{x.usage_ml.toFixed(2)} {d.base_unit}</td>
                    </>
                  ) : (
                    <>
                      <td className="py-1 text-right text-slate-600">{x.pour_ml}ml</td>
                      <td className="py-1 text-right text-slate-700">{(x.usage_ml / 1000).toFixed(2)}L</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-2">Possible cause</h2>
        <VarianceReasonControl ingredientId={d.ingredient_id} current={d.latest_reason} />
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-2">Suggested checks</h2>
        <ul className="text-sm text-slate-600 space-y-1 list-disc pl-5">
          {checks.map((c) => <li key={c}>{c}</li>)}
        </ul>
      </section>

      {d.trend.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-2">Recent variance</h2>
          <p className="text-sm text-slate-600">
            {d.trend.map((p) => (p.variance_cost_p !== null ? `£${Math.abs(p.variance_cost_p / 100).toFixed(2)}` : '—')).join(' · ')}
          </p>
        </section>
      )}
    </main>
  )
}
