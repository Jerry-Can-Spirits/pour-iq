import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { readDemoOverlay } from '@/lib/pouriq/demo/overlay'
import { DemoPriceToggle } from '@/components/pouriq/demo/DemoPriceToggle'
import { getMenu, listCocktailsForMenu } from '@/lib/pouriq/menus'
import { calculateMenuMetrics } from '@/lib/pouriq/calculations'
import { LicenceGate } from '@/components/pouriq/LicenceGate'
import { KpiCards } from '@/components/pouriq/KpiCards'
import { CocktailTable } from '@/components/pouriq/CocktailTable'
import { IngredientOverlapTable } from '@/components/pouriq/IngredientOverlapTable'
import { RecommendationStream } from '@/components/pouriq/RecommendationStream'
import { DeleteMenuButton } from '@/components/pouriq/DeleteMenuButton'
import { VatModeToggle } from '@/components/pouriq/VatModeToggle'
import { PrintReportButton } from '@/components/pouriq/PrintReportButton'
import { BulkPromoActions } from '@/components/pouriq/BulkPromoActions'
import { BulkGenerateDescriptionsButton } from '@/components/pouriq/BulkGenerateDescriptionsButton'
import { VolumeEditor } from '@/components/pouriq/VolumeEditor'
import { DuplicateMenuButton } from '@/components/pouriq/DuplicateMenuButton'
import { MakeActiveButton } from '@/components/pouriq/MakeActiveButton'
import { listVolumesForPeriod, listVolumesForMenu, currentPeriod } from '@/lib/pouriq/volumes'
import { PRIMARY_BUTTON, SECONDARY_BUTTON, SECONDARY_BUTTON_SM } from '@/lib/pouriq/button-styles'
import { classifyMenuBalance } from '@/lib/pouriq/menu-balance'
import { MenuBalance } from '@/components/pouriq/MenuBalance'
import { buildMenuPerformance } from '@/lib/pouriq/menu-performance'
import { MenuMatrix } from '@/components/pouriq/MenuMatrix'
import { buildMoversReport } from '@/lib/pouriq/movers'
import { MoversReport } from '@/components/pouriq/MoversReport'
import { menuCostConfidence } from '@/lib/pouriq/cost-confidence'
import { categoryGp } from '@/lib/pouriq/category-gp'
import { CategoryGpTable } from '@/components/pouriq/CategoryGpTable'
import { Tabs } from '@/components/pouriq/Tabs'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ menuId: string }>
}

interface StartTile {
  title: string
  description: string
  href: string
  cta: string
}

function StartTile({ title, description, href, cta }: StartTile) {
  return (
    <Link
      href={href}
      className="block bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-600 rounded-xl p-6 transition-colors"
    >
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed mb-4">{description}</p>
      <span className="inline-flex items-center text-emerald-700 text-sm font-medium">
        {cta}
        <span aria-hidden="true" className="ml-2">→</span>
      </span>
    </Link>
  )
}

export default async function MenuDetailPage({ params }: Props) {
  const access = await checkPourIqAccess()
  if (access.kind === 'no-session') redirect('/login')
  if (access.kind === 'no-licence') return <LicenceGate />

  const { menuId } = await params
  const { env } = await getCloudflareContext()
  const db = env.DB as D1Database
  const menu = await getMenu(db, menuId, access.tradeAccountId)
  if (!menu) notFound()

  const baseCocktails = await listCocktailsForMenu(db, menuId)
  // Demo: overlay the session's price toggles over base data at read time
  // (never D1), so a persisted override shows in the table on reload.
  const priceOverrides: Record<string, number> =
    access.role === 'demo' ? ((await readDemoOverlay()).priceOverrides ?? {}) : {}
  const cocktails = Object.keys(priceOverrides).length
    ? baseCocktails.map((c) => (priceOverrides[c.id] != null ? { ...c, sale_price_p: priceOverrides[c.id] } : c))
    : baseCocktails
  const period = currentPeriod(menu.volume_cadence)
  const volumes = await listVolumesForPeriod(db, menuId, period.start, period.end)
  const metrics = calculateMenuMetrics(cocktails, menu.prices_include_vat === 1, volumes)
  const perf = buildMenuPerformance(metrics.cocktail_metrics, menu.target_gp_pct)
  const allVolumes = await listVolumesForMenu(db, menuId)
  const movers = buildMoversReport(cocktails.map((c) => ({ id: c.id, name: c.name })), allVolumes)
  const { unconfirmed_drinks } = menuCostConfidence(cocktails)
  const missingCount = cocktails.filter((c) => !c.description || c.description.trim() === '').length

  const volumeUnits = new Map<string, number>()
  for (const v of volumes) volumeUnits.set(v.cocktail_id, v.units_sold)

  const cocktailById = new Map(cocktails.map((c) => [c.id, c]))
  const categoryRows = categoryGp(
    metrics.cocktail_metrics.map((m) => ({
      item_type: cocktailById.get(m.cocktail_id)!.item_type,
      gp_pct: m.gp_pct,
      margin_p: m.margin_p,
      net_sale_p: m.net_sale_p,
      units_sold: volumeUnits.get(m.cocktail_id) ?? 0,
      cost_complete: m.cost_complete,
      sale_price_p: m.sale_price_p,
    })),
    menu.target_gp_pct,
  )

  const includedDrinks = metrics.cocktail_metrics
    .filter((m) => m.cost_complete && m.sale_price_p > 0)
    .map((m) => ({
      id: m.cocktail_id,
      name: m.name,
      gp_pct: m.gp_pct,
      units: volumeUnits.get(m.cocktail_id) ?? 0,
    }))

  const balanceIncompleteCount = cocktails.length - includedDrinks.length
  const balance = classifyMenuBalance(includedDrinks, {
    targetGpPct: menu.target_gp_pct,
    avgGpPct: metrics.avg_gp_pct,
  })

  const reportDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const demoDrinks =
    access.role === 'demo'
      ? metrics.cocktail_metrics.map((m) => ({
          cocktail_id: m.cocktail_id,
          name: m.name,
          sale_price_p: m.sale_price_p,
          pour_cost_p: m.pour_cost_p,
        }))
      : []

  return (
    <main className="min-h-screen print-region">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        {access.role === 'demo' && demoDrinks.length > 0 && (
          <DemoPriceToggle drinks={demoDrinks} includesVat={menu.prices_include_vat === 1} />
        )}
        <div className="flex items-baseline gap-4 no-print">
          <Link href="/menus" className="text-sm text-slate-500 hover:text-slate-700">← All menus</Link>
          <Link href="/library" className="text-sm text-slate-500 hover:text-slate-700">Library</Link>
        </div>
        {/* Print-only report header — never visible on screen */}
        <div className="hidden print:block mb-6 pb-4 border-b border-stone-300">
          <p className="text-xs uppercase tracking-widest">Pour IQ™ menu report</p>
          <p className="text-xs">Generated {reportDate}</p>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-3 mt-4 mb-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">{menu.name}</h1>
            {menu.is_active === 1 ? (
              <span className="inline-block px-2 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-600 text-[10px] uppercase tracking-widest no-print">Active</span>
            ) : (
              <span className="no-print"><MakeActiveButton menuId={menuId} /></span>
            )}
          </div>
          {cocktails.length > 0 && (
            <div className="flex flex-wrap items-start gap-2 no-print">
              <DuplicateMenuButton menuId={menuId} menuName={menu.name} />
              <Link href={`/${menuId}/import`} className={SECONDARY_BUTTON_SM}>
                Import drinks
              </Link>
              <Link href={`/${menuId}/edit`} className={PRIMARY_BUTTON}>
                Add drink
              </Link>
              <BulkGenerateDescriptionsButton menuId={menuId} missingCount={missingCount} />
              <Link href={`/${menuId}/menu-copy`} className={SECONDARY_BUTTON}>Menu copy</Link>
              <Link href={`/${menuId}/specs`} className={SECONDARY_BUTTON}>Spec cards</Link>
              <Link href={`/${menuId}/menu-builder`} className={SECONDARY_BUTTON}>Menu builder</Link>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-10">
          <p className="text-slate-500 text-sm">
            {menu.venue_type ?? 'Menu'}{menu.city && ` · ${menu.city}`} · Target GP {menu.target_gp_pct}%
            <span className="hidden print:inline"> · Prices {menu.prices_include_vat === 1 ? 'include VAT' : 'net of VAT'}</span>
          </p>
          <span className="no-print">
            <VatModeToggle menuId={menuId} pricesIncludeVat={menu.prices_include_vat === 1} />
          </span>
        </div>

        {cocktails.length === 0 ? (
          <div className="space-y-4 no-print">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-1">Get drinks onto this menu</h2>
              <p className="text-slate-600 text-sm mb-6">Pick the option that matches how your menu currently lives.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <StartTile
                  title="Import from PDF"
                  description="Upload your existing drinks menu PDF. We extract every drink and inferred recipe — you review before saving."
                  href={`/${menuId}/import?source=pdf`}
                  cta="Upload PDF"
                />
                <StartTile
                  title="Import from spreadsheet"
                  description="Excel or CSV. Best if your cocktails and costs already live in a sheet."
                  href={`/${menuId}/import?source=spreadsheet`}
                  cta="Upload spreadsheet"
                />
                <StartTile
                  title="Add drinks manually"
                  description="Type each drink in one at a time. Best for short menus or small adjustments."
                  href={`/${menuId}/edit`}
                  cta="Add a drink"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <KpiCards menu={menu} metrics={metrics} />
            <Tabs
              ariaLabel="Menu sections"
              panels={[
                {
                  id: 'drinks',
                  label: 'Drinks',
                  content: (
                    <div className="space-y-8">
                      <section>
                        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
                          <h2 className="text-xl font-bold text-slate-900">Drinks</h2>
                          <div className="no-print">
                            <BulkPromoActions menuId={menuId} />
                          </div>
                        </div>
                        {unconfirmed_drinks > 0 && (
                          <p className="text-sm text-slate-500 mb-3 no-print">{unconfirmed_drinks} drink{unconfirmed_drinks === 1 ? '' : 's'} use unconfirmed costs.</p>
                        )}
                        <CocktailTable
                          menuId={menuId}
                          cocktails={cocktails}
                          metrics={metrics.cocktail_metrics}
                          targetGpPct={menu.target_gp_pct}
                          statusById={perf.statusById}
                        />
                      </section>
                      <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Movers (last 30 days)</h2>
                        <MoversReport report={movers} />
                      </section>
                    </div>
                  ),
                },
                {
                  id: 'sales',
                  label: 'Sales',
                  content: (
                    <div className="space-y-8">
                      <section className="no-print">
                        <VolumeEditor
                          menuId={menuId}
                          cocktails={cocktails}
                          metrics={metrics.cocktail_metrics}
                          initialCadence={menu.volume_cadence}
                        />
                      </section>
                      {/* Print-only sales volume summary. The interactive editor is
                          hidden on paper; this block surfaces the period range and
                          total contribution so the report stands on its own. The
                          per-drink Units/Contribution columns live on the drinks
                          table above. */}
                      {volumes.length > 0 && (() => {
                        const totalUnits = volumes.reduce((s, v) => s + v.units_sold, 0)
                        const totalContribution = metrics.cocktail_metrics.reduce(
                          (s, m) => s + (m.volume?.contribution_p ?? 0), 0
                        )
                        const fmtDate = (s: string) =>
                          new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                        return (
                          <section className="hidden print:block">
                            <h2 className="text-xl font-serif font-bold text-slate-900 mb-2">Sales volume</h2>
                            <p className="text-sm">
                              Period: {fmtDate(period.start)} – {fmtDate(period.end)} ({menu.volume_cadence}).
                            </p>
                            <p className="text-sm mt-1">
                              {totalUnits} drink{totalUnits === 1 ? '' : 's'} sold ·{' '}
                              Total contribution £{(totalContribution / 100).toFixed(2)}
                            </p>
                            <p className="text-xs mt-2">Per-drink units and contribution shown in the Drinks table above.</p>
                          </section>
                        )
                      })()}
                    </div>
                  ),
                },
                {
                  id: 'performance',
                  label: 'Performance',
                  content: (
                    <div className="space-y-8">
                      <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Menu performance</h2>
                        {perf.hasSales ? (
                          <MenuMatrix quadrants={perf.quadrants} />
                        ) : (
                          <p className="text-sm text-slate-500">Add this week&rsquo;s sales below to see your menu performance matrix.</p>
                        )}
                      </section>
                      <section className="no-print">
                        <h2 className="text-lg font-semibold text-slate-900 mb-3">Menu balance</h2>
                        <MenuBalance
                          result={balance}
                          targetGpPct={menu.target_gp_pct}
                          incompleteCount={balanceIncompleteCount}
                          hasSalesData={balance.totalUnits > 0}
                        />
                      </section>
                      <section className="no-print">
                        <CategoryGpTable
                          rows={categoryRows}
                          targetGpPct={menu.target_gp_pct}
                          excludedCount={metrics.incomplete_cost_count}
                        />
                      </section>
                      <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4">AI recommendations</h2>
                        <RecommendationStream menuId={menuId} />
                      </section>
                    </div>
                  ),
                },
                {
                  id: 'stock',
                  label: 'Stock',
                  content: (
                    <div className="space-y-8">
                      <section className="no-print">
                        <h2 className="text-lg font-semibold text-slate-900 mb-2">Variance</h2>
                        <p className="text-sm text-slate-500 mb-3">Stock variance is now counted across your whole bar, not per menu.</p>
                        <Link href="/variance" className="text-sm text-emerald-700 hover:text-emerald-600">Go to Variance</Link>
                      </section>
                      <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Ingredient overlap</h2>
                        <IngredientOverlapTable overlap={metrics.ingredient_overlap} />
                      </section>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}

        {cocktails.length > 0 && (
          <div className="flex justify-end mt-12 pt-6 border-t border-slate-200 no-print">
            <PrintReportButton />
          </div>
        )}

        <div className="flex justify-end mt-16 pt-8 border-t border-slate-200 no-print">
          <DeleteMenuButton menuId={menuId} menuName={menu.name} />
        </div>
      </div>
    </main>
  )
}
