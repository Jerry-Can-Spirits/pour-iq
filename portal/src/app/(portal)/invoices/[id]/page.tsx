import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { getInvoice, listInvoiceLines } from '@/lib/pouriq/invoices'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { DeleteInvoiceButton } from '@/components/pouriq/DeleteInvoiceButton'
import { InvoiceDetailPanes } from '@/components/pouriq/InvoiceDetailPanes'
import { SECONDARY_BUTTON_SM } from '@/lib/pouriq/button-styles'
import { listAccountingConnections, isConnectionReady } from '@/lib/pouriq/accounting/connections'
import { getPushForInvoiceProvider, PUSH_CLAIM_SENTINEL } from '@/lib/pouriq/accounting/pushes'
import { AccountingPushStatus } from '@/components/pouriq/AccountingPushStatus'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

function formatMoney(p: number | null): string {
  if (p === null) return '—'
  return `£${(p / 100).toFixed(2)}`
}

export default async function InvoiceDetailPage({ params }: Props) {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { id } = await params
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database

  const invoice = await getInvoice(db, id, access.tradeAccountId)
  if (!invoice) notFound()

  const accountingConnections = await listAccountingConnections(db, access.tradeAccountId)
  const accountingConn = accountingConnections.find(isConnectionReady) ?? null
  const push = accountingConn ? await getPushForInvoiceProvider(db, id, accountingConn.provider) : null
  // Both columns are D1 datetime('now') strings in the same format, so a plain
  // string comparison is the correct chronological test. The sweep only covers
  // invoices committed at or after the connection was created.
  const predatesConnection = !!accountingConn && !push && invoice.created_at < accountingConn.created_at

  const lines = await listInvoiceLines(db, id)
  const applied = lines.filter((l) => l.applied === 1)
  const skipped = lines.filter((l) => l.applied === 0)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        <Link href="/invoices" className="text-sm text-slate-500 hover:text-slate-700">← Recent invoices</Link>
        <div className="flex flex-wrap items-baseline justify-between gap-3 mt-3 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
              {invoice.supplier_name ?? 'Invoice'}
            </h1>
            <p className="text-slate-500 text-sm mt-2">
              {invoice.invoice_date ?? '—'} · {invoice.invoice_number ?? 'no number'} · net total {formatMoney(invoice.net_total_p)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/invoices/${invoice.id}/impact`} className="px-4 py-2 text-sm text-emerald-700 hover:text-emerald-600 underline">
              View GP impact
            </Link>
            {invoice.r2_key && (
              <a
                href={`/api/pouriq/invoices/${invoice.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className={SECONDARY_BUTTON_SM}
              >
                Download original PDF
              </a>
            )}
            <DeleteInvoiceButton invoiceId={invoice.id} />
          </div>
        </div>

        {accountingConn && (
          <div className="mt-4">
            <AccountingPushStatus
              invoiceId={id}
              provider={accountingConn.provider}
              providerTitle={accountingConn.provider === 'xero' ? 'Xero' : 'QuickBooks'}
              status={push?.status === 'failed' && push.error === PUSH_CLAIM_SENTINEL ? 'pending' : (push?.status ?? 'pending')}
              error={push?.status === 'failed' && push.error === PUSH_CLAIM_SENTINEL ? null : (push?.error ?? null)}
              pushedAt={push?.status === 'pushed' ? push.pushed_at : null}
              predatesConnection={predatesConnection}
            />
          </div>
        )}

        <InvoiceDetailPanes docSrc={invoice.r2_key ? `/api/pouriq/invoices/${id}/pdf` : null}>
          {applied.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-slate-200">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">Applied lines ({applied.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-slate-500 text-xs uppercase tracking-widest">
                      <th className="px-4 py-3">Line</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Net unit £</th>
                      <th className="px-4 py-3">Net line £</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applied.map((l) => (
                      <tr key={l.id} className="border-t border-slate-200">
                        <td className="px-4 py-3 text-slate-900">{l.extracted_name}</td>
                        <td className="px-4 py-3 text-slate-600">{l.extracted_quantity ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{formatMoney(l.extracted_unit_price_p)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatMoney(l.extracted_line_total_p)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {skipped.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-slate-200">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">Skipped lines ({skipped.length})</h2>
                <p className="text-xs text-slate-500 mt-1">Captured for the audit trail but did not update any library entry.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-slate-500 text-xs uppercase tracking-widest">
                      <th className="px-4 py-3">Line</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Net unit £</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skipped.map((l) => (
                      <tr key={l.id} className="border-t border-slate-200">
                        <td className="px-4 py-3 text-slate-900">{l.extracted_name}</td>
                        <td className="px-4 py-3 text-slate-600">{l.extracted_quantity ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{formatMoney(l.extracted_unit_price_p)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </InvoiceDetailPanes>
      </div>
    </main>
  )
}
