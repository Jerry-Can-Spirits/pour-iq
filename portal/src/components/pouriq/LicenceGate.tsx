import { PourIqWordmark } from '@/components/pouriq/PourIqWordmark'
import { PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'

export function LicenceGate() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-32">
        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <div className="mb-6">
            <PourIqWordmark />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">An additional service for trade accounts</h1>
          <p className="text-slate-600 leading-relaxed mb-4">
            Pour IQ is a margin and complexity analysis tool for drink menus. Trade customers can licence it as an add-on to their existing account.
          </p>
          <p className="text-slate-600 leading-relaxed mb-8">
            We are running a closed pilot. If you would like access, get in touch.
          </p>
          <a
            href="mailto:trade@jerrycanspirits.co.uk?subject=Pour%20IQ%20licence%20enquiry"
            className={PRIMARY_BUTTON}
          >
            Enquire about a licence
          </a>
        </div>
      </div>
    </main>
  )
}
