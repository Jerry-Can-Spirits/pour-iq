'use client'

import { useState } from 'react'
import { ALL_INGREDIENT_TYPES, type IngredientLibraryRow, type IngredientType } from '@/lib/pouriq/types'
import { attachBarcodeAction, saveLibraryEntryAction } from '@/lib/pouriq/server-actions'
import { BarcodeScanner } from '@/components/pouriq/BarcodeScanner'
import { BOTTLE_SIZES_ML, WEIGHT_SIZES_G } from '@/lib/pouriq/measures'
import { PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'
import { LibrarySearchSelect } from '@/components/pouriq/LibrarySearchSelect'

const inputClass = 'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm placeholder-slate-400 focus:border-emerald-500 focus:outline-hidden'
const labelClass = 'block text-xs font-medium text-slate-600 mb-1'
const chipClass = 'px-2 py-1 rounded-sm border text-xs transition-colors'
const chipActive = 'bg-emerald-50 border-emerald-600 text-emerald-700'
const chipIdle = 'bg-white border-slate-300 text-slate-600 hover:border-emerald-400'

interface Props {
  libraryEntries: IngredientLibraryRow[]
  selectedEntryId: string | null
  onChange: (entry: IngredientLibraryRow) => void
}

export function IngredientPicker({ libraryEntries, selectedEntryId, onChange }: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [scanInfo, setScanInfo] = useState<string | null>(null)
  // Inline-create form state (new model)
  const [name, setName] = useState('')
  const [ingredient_type, setIngredientType] = useState<IngredientType>('spirit')
  const [base_unit, setBaseUnit] = useState<'ml' | 'g' | 'each'>('ml')
  const [pack_size_str, setPackSizeStr] = useState('700')
  const [cost_pounds, setCostPounds] = useState('')
  const [purchase_qty_str, setPurchaseQtyStr] = useState('1')
  // When a scan didn't match an existing library entry, we surface
  // the scanned code so the new entry gets saved with it. Cleared on
  // form cancel.
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null)
  // True when name/type/size were prefilled from the cross-tenant
  // catalogue — surfaces a small hint so the user sanity-checks the
  // prefill before saving.
  const [prefilledFromCatalogue, setPrefilledFromCatalogue] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const selectedEntry = libraryEntries.find((e) => e.id === selectedEntryId) ?? null

  function selectEntry(entry: IngredientLibraryRow) {
    onChange(entry)
    setShowCreate(false)
    setScanInfo(null)
    setPendingBarcode(null)
    setPrefilledFromCatalogue(false)
  }

  async function handleScan(code: string) {
    setScanOpen(false)
    setScanInfo(null)
    setPrefilledFromCatalogue(false)
    // First check the local library copy for an instant match.
    const localMatch = libraryEntries.find((e) => e.barcode === code)
    if (localMatch) {
      selectEntry(localMatch)
      return
    }
    // Server lookup: tenant library + cross-tenant catalogue prefill.
    let cataloguePrefill: { name: string; ingredient_type: IngredientType; pack_size_ml: number | null } | null = null
    try {
      const res = await fetch(`/api/pouriq/library/by-barcode?code=${encodeURIComponent(code)}`)
      if (res.ok) {
        const data = await res.json() as {
          entry: IngredientLibraryRow | null
          catalogue: { name: string; ingredient_type: IngredientType; pack_size_ml: number | null; verified: boolean } | null
        }
        if (data.entry) {
          libraryEntries.push(data.entry)
          selectEntry(data.entry)
          return
        }
        if (data.catalogue) {
          cataloguePrefill = data.catalogue
        }
      }
    } catch { /* fall through to create flow */ }
    // No tenant match — open the inline create form with the barcode
    // prefilled, plus name/type/size from the shared catalogue if we
    // recognised the product.
    setPendingBarcode(code)
    setShowCreate(true)
    if (cataloguePrefill) {
      setName(cataloguePrefill.name)
      setIngredientType(cataloguePrefill.ingredient_type)
      if (cataloguePrefill.pack_size_ml) {
        setBaseUnit('ml')
        setPackSizeStr(String(cataloguePrefill.pack_size_ml))
      }
      setPrefilledFromCatalogue(true)
      setScanInfo(`Recognised ${code}. We've pre-filled the name, type and size — just add your cost.`)
    } else {
      setName('')
      setScanInfo(`Scanned ${code}. Fill in the rest to add it to your library.`)
    }
  }

  async function handleCreate() {
    setCreateError(null)
    if (!name.trim()) { setCreateError('Name required'); return }
    const pack_size = parseFloat(pack_size_str)
    const price_p = Math.round(parseFloat(cost_pounds) * 100)
    const purchase_qty = Math.max(1, Math.round(parseFloat(purchase_qty_str) || 1))
    if (base_unit !== 'each') {
      if (!Number.isFinite(pack_size) || pack_size <= 0) { setCreateError('Pack size invalid'); return }
    }
    if (!Number.isFinite(price_p) || price_p < 0) { setCreateError('Cost invalid'); return }
    setCreating(true)
    try {
      const result = await saveLibraryEntryAction(null, {
        name: name.trim(), ingredient_type,
        base_unit,
        pack_size: base_unit === 'each' ? 1 : pack_size,
        price_p,
        purchase_qty,
        barcode: pendingBarcode,
        notes: null,
      })
      const newEntry: IngredientLibraryRow = {
        id: result.entryId,
        trade_account_id: '',
        name: name.trim(),
        ingredient_type,
        base_unit,
        pack_size: base_unit === 'each' ? 1 : pack_size,
        price_p,
        price_includes_vat: 0,
        price_entered_p: price_p,
        pack_format: null,
        subcategory: null,
        is_prepared: 0,
        purchase_qty,
        yield_pct: 100,
        barcode: pendingBarcode,
        notes: null,
        cost_confidence: price_p > 0 ? 'set' : 'estimated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        allergens: '[]',
        dietary: '[]',
        allergens_reviewed: 0,
        abv: 0,
      }
      libraryEntries.push(newEntry)
      selectEntry(newEntry)
      setName(''); setCostPounds(''); setPurchaseQtyStr('1'); setShowCreate(false); setPendingBarcode(null)
    } catch (e) {
      setCreateError((e as Error).message || 'Could not create')
    } finally {
      setCreating(false)
    }
  }

  // After a scan that matched nothing, entries whose name resembles what the
  // user is creating and that have no barcode yet — offer to attach the code
  // to one of them instead of creating a duplicate.
  const attachCandidates = pendingBarcode && name.trim().length >= 2
    ? libraryEntries.filter((e) => !e.barcode && e.name.toLowerCase().includes(name.trim().toLowerCase())).slice(0, 3)
    : []

  async function handleAttach(target: IngredientLibraryRow) {
    if (!pendingBarcode) return
    setCreateError(null)
    setCreating(true)
    try {
      await attachBarcodeAction(target.id, pendingBarcode)
      target.barcode = pendingBarcode
      selectEntry(target)
      setName(''); setCostPounds(''); setPurchaseQtyStr('1'); setShowCreate(false)
    } catch (e) {
      setCreateError((e as Error).message || 'Could not attach barcode')
    } finally {
      setCreating(false)
    }
  }

  const sizePresets = base_unit === 'ml' ? BOTTLE_SIZES_ML : base_unit === 'g' ? WEIGHT_SIZES_G : null

  return (
    <div className="relative">
      {!showCreate && (
        <div className="flex gap-2">
          <LibrarySearchSelect
            libraryEntries={libraryEntries}
            onPick={(e) => selectEntry(libraryEntries.find((le) => le.id === e.id)!)}
            onRequestCreate={(q) => { setShowCreate(true); setName(q) }}
            placeholder={selectedEntry ? selectedEntry.name : 'Pick an ingredient...'}
            initialQuery={selectedEntry ? selectedEntry.name : ''}
          />
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            title="Scan a barcode"
            aria-label="Scan a barcode"
            className="shrink-0 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:border-emerald-500 transition-colors text-sm"
          >
            Scan
          </button>
        </div>
      )}

      {scanInfo && !scanOpen && (
        <p className="mt-1 text-xs text-emerald-700">{scanInfo}</p>
      )}

      {showCreate && (
        <div className="absolute z-10 left-0 right-0 mt-1 p-4 bg-white border border-slate-200 rounded-lg shadow-lg space-y-3">
          {pendingBarcode && (
            <p className="text-xs text-emerald-700">Barcode: <span className="font-mono">{pendingBarcode}</span></p>
          )}
          {attachCandidates.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 space-y-1">
              <p className="text-xs text-amber-800">Already in your library? Attach this barcode instead of creating a duplicate:</p>
              {attachCandidates.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  disabled={creating}
                  onClick={() => handleAttach(e)}
                  className="block w-full text-left text-xs text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
                >
                  Use &ldquo;{e.name}&rdquo; and attach barcode →
                </button>
              ))}
            </div>
          )}
          {prefilledFromCatalogue && (
            <p className="text-xs text-emerald-700">Name, type and size came from the Pour IQ shared catalogue — sanity-check before saving.</p>
          )}
          <div>
            <label className={labelClass}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Expedition Spiced Rum" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Type</label>
              <select value={ingredient_type} onChange={(e) => setIngredientType(e.target.value as IngredientType)} className={inputClass}>
                {ALL_INGREDIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>How you buy it</label>
              <select value={base_unit} onChange={(e) => {
                const bu = e.target.value as 'ml' | 'g' | 'each'
                setBaseUnit(bu)
                setPackSizeStr(bu === 'ml' ? '700' : bu === 'g' ? '1000' : '1')
              }} className={inputClass}>
                <option value="ml">Liquid (ml)</option>
                <option value="g">Weight (g)</option>
                <option value="each">Count (each)</option>
              </select>
            </div>
          </div>
          {base_unit !== 'each' && (
            <div>
              <label className={labelClass}>{base_unit === 'ml' ? 'Size (ml)' : 'Weight per pack (g)'}</label>
              {sizePresets && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {sizePresets.map((s) => (
                    <button type="button" key={s} onClick={() => setPackSizeStr(String(s))}
                      className={`${chipClass} ${pack_size_str === String(s) ? chipActive : chipIdle}`}>
                      {s}{base_unit}
                    </button>
                  ))}
                </div>
              )}
              <input type="number" step="1" min={1} value={pack_size_str} onChange={(e) => setPackSizeStr(e.target.value)} className={inputClass}
                placeholder={base_unit === 'ml' ? '330, 700, 1000…' : '500, 1000, 2500…'} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Cost (£)</label>
              <input type="number" step="0.01" min={0} value={cost_pounds} onChange={(e) => setCostPounds(e.target.value)} className={inputClass} placeholder="25.00" />
            </div>
            <div>
              <label className={labelClass}>Packs bought</label>
              <input type="number" step="1" min={1} value={purchase_qty_str} onChange={(e) => setPurchaseQtyStr(e.target.value)} className={inputClass} placeholder="1" />
              <p className="text-xs text-slate-500 mt-1">
                {base_unit === 'each' ? 'e.g. 6 for a 6-pack' : 'e.g. 24 for a case'}
              </p>
            </div>
          </div>
          {createError && <p role="alert" className="text-xs text-rose-600">{createError}</p>}
          <div className="flex justify-between items-center">
            <button type="button" onClick={() => { setShowCreate(false); setPendingBarcode(null); setScanInfo(null); setPrefilledFromCatalogue(false) }} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
            <button type="button" onClick={handleCreate} disabled={creating} className={PRIMARY_BUTTON}>
              {creating ? 'Adding…' : 'Add to library'}
            </button>
          </div>
        </div>
      )}

      {scanOpen && (
        <BarcodeScanner onScan={handleScan} onClose={() => setScanOpen(false)} />
      )}
    </div>
  )
}
