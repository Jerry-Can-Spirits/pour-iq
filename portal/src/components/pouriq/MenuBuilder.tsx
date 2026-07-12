'use client'

import { Fragment, useMemo, useState, useTransition, type DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { SECONDARY_BUTTON_SM, PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'
import { INPUT } from '@/lib/pouriq/ui'
import { ALLERGEN_LABELS } from '@/lib/pouriq/allergens'
import type { AllergenKey } from '@/lib/pouriq/allergens'
import type { MenuSectionRow, ItemType, MenuTheme, LogoAlign } from '@/lib/pouriq/types'
import { MENU_THEMES } from '@/lib/pouriq/types'
import { menuTheme, type ThemeTokens } from '@/lib/pouriq/menu-theme'
import { insertAt } from '@/lib/pouriq/reorder'
import {
  createSectionAction,
  renameSectionAction,
  deleteSectionAction,
  reorderSectionsAction,
  moveDrinkAction,
  reorderDrinksAction,
  setMenuThemeAction,
  setMenuLogoAlignAction,
  removeMenuLogoAction,
} from '@/lib/pouriq/server-actions'

interface AllergenInfo {
  contains: AllergenKey[]
  reviewed: boolean
  vegetarian: boolean
  vegan: boolean
  glutenFree: boolean
}

interface AbvInfo {
  abvPct: number
  units: number
  complete: boolean
}

interface Drink {
  id: string
  name: string
  description: string | null
  sale_price_p: number | null
  section_id: string | null
  item_type: ItemType
  position: number
  photo_r2_key: string | null
  updated_at: string
}

interface Props {
  menuId: string
  menuName: string
  sections: MenuSectionRow[]
  drinks: Drink[]
  theme: MenuTheme
  logoR2Key: string | null
  logoAlign: LogoAlign
  menuUpdatedAt: string
  allergenInfoById: Record<string, AllergenInfo>
  abvById: Record<string, AbvInfo>
}

interface SectionView {
  section: MenuSectionRow
  drinks: Drink[]
  subSections: { section: MenuSectionRow; drinks: Drink[] }[]
}

const UNPLACED_KEY = 'unplaced'

function formatMoney(p: number) { return `£${(p / 100).toFixed(2)}` }
function isTemp(id: string) { return id.startsWith('temp:') }

function buildViewModel(sections: MenuSectionRow[], drinks: Drink[]) {
  const top = sections
    .filter((s) => s.parent_section_id === null)
    .sort((a, b) => a.position - b.position)
  const drinksFor = (sectionId: string) =>
    drinks.filter((d) => d.section_id === sectionId).sort((a, b) => a.position - b.position)
  const topSections: SectionView[] = top.map((section) => ({
    section,
    drinks: drinksFor(section.id),
    subSections: sections
      .filter((s) => s.parent_section_id === section.id)
      .sort((a, b) => a.position - b.position)
      .map((sub) => ({ section: sub, drinks: drinksFor(sub.id) })),
  }))
  const unplaced = drinks.filter((d) => d.section_id === null).sort((a, b) => a.position - b.position)
  return { topSections, unplaced }
}

function DrinkPreview({
  drink,
  showPrices,
  showDescriptions,
  showPhotos,
  showAllergens,
  allergenInfo,
  showAbv,
  abvInfo,
  tok,
}: {
  drink: Drink
  showPrices: boolean
  showDescriptions: boolean
  showPhotos: boolean
  showAllergens: boolean
  allergenInfo: AllergenInfo | undefined
  showAbv: boolean
  abvInfo: AbvInfo | undefined
  tok: ThemeTokens
}) {
  return (
    <div className="mb-4 break-inside-avoid">
      {showPhotos && drink.photo_r2_key && (
        <img
          src={`/api/pouriq/cocktails/${drink.id}/photo?v=${encodeURIComponent(drink.updated_at)}`}
          alt=""
          className="w-full h-32 object-contain rounded mb-2 print:h-24"
        />
      )}
      <div className="flex items-baseline justify-between gap-4">
        <h4 className={`text-lg font-bold ${tok.drinkName}`}>{drink.name}</h4>
        {showPrices && drink.sale_price_p !== null && (
          <span className={`text-lg whitespace-nowrap ${tok.price}`}>{formatMoney(drink.sale_price_p)}</span>
        )}
      </div>
      {showDescriptions && drink.description && drink.description.trim() !== '' && (
        <p className={`mt-1 leading-relaxed ${tok.desc}`}>{drink.description}</p>
      )}
      {showAllergens && allergenInfo && (
        <div className={`mt-1 ${tok.desc}`}>
          {!allergenInfo.reviewed ? (
            <p className="text-xs text-amber-700 print:text-black">Allergen info incomplete.</p>
          ) : (
            <>
              {allergenInfo.contains.length > 0 && (
                <p className="text-xs">
                  <span className="font-semibold">Contains:</span>{' '}
                  {allergenInfo.contains.map((a) => ALLERGEN_LABELS[a]).join(', ')}
                </p>
              )}
              {(allergenInfo.vegetarian || allergenInfo.vegan || allergenInfo.glutenFree) && (
                <span className="inline-flex gap-1.5 mt-0.5">
                  {allergenInfo.vegetarian && (
                    <span className="text-xs border border-current rounded-sm px-1 py-0.5">V</span>
                  )}
                  {allergenInfo.vegan && (
                    <span className="text-xs border border-current rounded-sm px-1 py-0.5">Ve</span>
                  )}
                  {allergenInfo.glutenFree && (
                    <span className="text-xs border border-current rounded-sm px-1 py-0.5">GF</span>
                  )}
                </span>
              )}
            </>
          )}
        </div>
      )}
      {showAbv && abvInfo && (
        <div className={`mt-1 ${tok.desc}`}>
          {abvInfo.complete ? (
            <p className="text-xs">
              ABV {abvInfo.abvPct}% &middot; {abvInfo.units} units
            </p>
          ) : (
            <p className="text-xs text-amber-700 print:text-black">ABV estimate incomplete.</p>
          )}
        </div>
      )}
    </div>
  )
}

function ArrangeDrink({
  drink,
  index,
  isFirst,
  isLast,
  sectionOptions,
  onMove,
  onDropAt,
  onMoveUp,
  onMoveDown,
  disabled,
}: {
  drink: Drink
  index: number
  isFirst: boolean
  isLast: boolean
  sectionOptions: { id: string; label: string }[]
  onMove: (drinkId: string, sectionId: string | null) => void
  onDropAt: (drinkId: string, dropIndex: number, targetSectionId: string | null) => void
  onMoveUp: () => void
  onMoveDown: () => void
  disabled: boolean
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', drink.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const id = e.dataTransfer.getData('text/plain')
        if (id) onDropAt(id, index, drink.section_id)
      }}
      className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 cursor-grab active:cursor-grabbing"
    >
      <span className="text-sm text-slate-800 truncate">{drink.name}</span>
      <div className="flex items-center gap-2 shrink-0">
        {drink.sale_price_p !== null && (
          <span className="text-xs text-slate-500 whitespace-nowrap">{formatMoney(drink.sale_price_p)}</span>
        )}
        <button type="button" onClick={onMoveUp} disabled={isFirst || disabled} aria-label="Move up" className="px-1 py-0.5 text-slate-500 hover:text-slate-800 disabled:opacity-30 text-xs">&#8593;</button>
        <button type="button" onClick={onMoveDown} disabled={isLast || disabled} aria-label="Move down" className="px-1 py-0.5 text-slate-500 hover:text-slate-800 disabled:opacity-30 text-xs">&#8595;</button>
        <label htmlFor={`move-${drink.id}`} className="sr-only">Move {drink.name} to</label>
        <select
          id={`move-${drink.id}`}
          value={drink.section_id ?? ''}
          disabled={disabled}
          onChange={(e) => onMove(drink.id, e.target.value === '' ? null : e.target.value)}
          className="text-xs border border-slate-300 rounded-md px-1.5 py-1 bg-white text-slate-700 max-w-[9rem]"
        >
          <option value="">Unplaced</option>
          {sectionOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function MenuBuilder({ menuId, menuName, sections, drinks, theme, logoR2Key, logoAlign, menuUpdatedAt, allergenInfoById, abvById }: Props) {
  const router = useRouter()

  const [title, setTitle] = useState(menuName)
  const [columns, setColumns] = useState<1 | 2>(1)
  const [showPrices, setShowPrices] = useState(true)
  const [showDescriptions, setShowDescriptions] = useState(true)
  const [showPhotos, setShowPhotos] = useState(drinks.some((d) => d.photo_r2_key !== null))
  const [showAllergens, setShowAllergens] = useState(() =>
    Object.values(allergenInfoById).some(
      (info) => info.reviewed || info.contains.length > 0 || info.vegetarian || info.vegan || info.glutenFree,
    ),
  )
  const [showAbv, setShowAbv] = useState(() =>
    Object.values(abvById).some((info) => !info.complete || info.abvPct > 0),
  )

  const [localTheme, setLocalTheme] = useState<MenuTheme>(theme)
  const [localLogoR2Key, setLocalLogoR2Key] = useState<string | null>(logoR2Key)
  const [localLogoAlign, setLocalLogoAlign] = useState<LogoAlign>(logoAlign)
  const [logoVersion, setLogoVersion] = useState(0)

  const [localSections, setLocalSections] = useState<MenuSectionRow[]>(sections)
  const [localDrinks, setLocalDrinks] = useState<Drink[]>(drinks)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null)
  const [subName, setSubName] = useState('')
  const [newTop, setNewTop] = useState('')
  const [dropKey, setDropKey] = useState<string | null>(null)

  const tok = useMemo(() => menuTheme(localTheme), [localTheme])
  const { topSections, unplaced } = useMemo(() => buildViewModel(localSections, localDrinks), [localSections, localDrinks])
  const hasPreview = topSections.some((t) => t.drinks.length > 0 || t.subSections.some((s) => s.drinks.length > 0))

  const sectionOptions = useMemo(
    () =>
      topSections.flatMap((t) => [
        { id: t.section.id, label: t.section.name },
        ...t.subSections.map((s) => ({ id: s.section.id, label: `↳ ${s.section.name}` })),
      ]),
    [topSections],
  )

  function persist(action: () => Promise<void>, revert: () => void, message: string) {
    setError(null)
    startTransition(async () => {
      try {
        await action()
      } catch {
        revert()
        setError(message)
      }
    })
  }

  function handleThemeChange(t: MenuTheme) {
    const prev = localTheme
    setLocalTheme(t)
    persist(
      () => setMenuThemeAction(menuId, t),
      () => setLocalTheme(prev),
      'Could not update the theme. The change was not saved.',
    )
  }

  function handleLogoAlignChange(a: LogoAlign) {
    const prev = localLogoAlign
    setLocalLogoAlign(a)
    persist(
      () => setMenuLogoAlignAction(menuId, a),
      () => setLocalLogoAlign(prev),
      'Could not update the logo alignment. The change was not saved.',
    )
  }

  function handleRemoveLogo() {
    const prevKey = localLogoR2Key
    setLocalLogoR2Key(null)
    persist(
      () => removeMenuLogoAction(menuId),
      () => setLocalLogoR2Key(prevKey),
      'Could not remove the logo. The change was not saved.',
    )
  }

  function handleLogoUpload(file: File) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('target', 'menu-logo')
    fd.append('id', menuId)
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/pouriq/images/upload', { method: 'POST', body: fd })
        if (!res.ok) { setError('Could not upload logo'); return }
        setLocalLogoR2Key('set')
        setLogoVersion((v) => v + 1)
        router.refresh()
      } catch {
        setError('Could not upload logo')
      }
    })
  }

  function moveDrinkTo(drinkId: string, targetSectionId: string | null) {
    const drink = localDrinks.find((d) => d.id === drinkId)
    if (!drink) return
    if (targetSectionId !== null && isTemp(targetSectionId)) return
    const prevDrinks = localDrinks
    const newPosition = localDrinks.filter((d) => d.section_id === targetSectionId).length
    const updated = localDrinks.find((d) => d.id === drinkId)!
    const rest = localDrinks.filter((d) => d.id !== drinkId)
    setLocalDrinks([...rest, { ...updated, section_id: targetSectionId }])
    persist(
      () => moveDrinkAction(drinkId, targetSectionId, menuId, newPosition),
      () => setLocalDrinks(prevDrinks),
      'Could not move that drink. The change was not saved.',
    )
  }

  function reorderDrinkAt(drinkId: string, dropIndex: number, targetSectionId: string | null) {
    if (targetSectionId !== null && isTemp(targetSectionId)) return
    const ordered = localDrinks
      .filter((d) => d.section_id === targetSectionId)
      .sort((a, b) => a.position - b.position)
    const newOrderedIds = insertAt(ordered.map((d) => d.id), drinkId, dropIndex)
    const prevDrinks = localDrinks
    const posById = new Map(newOrderedIds.map((id, i) => [id, i]))
    setLocalDrinks(localDrinks.map((d) => posById.has(d.id) ? { ...d, section_id: targetSectionId, position: posById.get(d.id)! } : d))
    persist(
      () => reorderDrinksAction(menuId, targetSectionId, newOrderedIds),
      () => setLocalDrinks(prevDrinks),
      'Could not reorder that drink. The change was not saved.',
    )
  }

  function persistReorder(orderedIds: string[]) {
    const prevSections = localSections
    const posById = new Map(orderedIds.map((id, i) => [id, i]))
    setLocalSections(localSections.map((s) => (posById.has(s.id) ? { ...s, position: posById.get(s.id)! } : s)))
    persist(
      () => reorderSectionsAction(orderedIds, menuId),
      () => setLocalSections(prevSections),
      'Could not reorder the sections. The change was not saved.',
    )
  }

  function reorderSibling(siblings: MenuSectionRow[], sectionId: string, dir: 'up' | 'down') {
    if (siblings.some((s) => isTemp(s.id))) return
    const ordered = [...siblings].sort((a, b) => a.position - b.position)
    const idx = ordered.findIndex((s) => s.id === sectionId)
    const swap = dir === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swap < 0 || swap >= ordered.length) return
    const next = [...ordered]
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    persistReorder(next.map((s) => s.id))
  }

  function addSection(parentId: string | null, name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    if (parentId !== null && isTemp(parentId)) return
    const tempId = `temp:${crypto.randomUUID()}`
    const position = localSections.filter((s) => s.parent_section_id === parentId).length
    const optimistic: MenuSectionRow = {
      id: tempId,
      menu_id: menuId,
      name: trimmed,
      parent_section_id: parentId,
      position,
      created_at: '',
    }
    const prevSections = localSections
    setLocalSections([...localSections, optimistic])
    setError(null)
    startTransition(async () => {
      try {
        const { sectionId } = await createSectionAction(menuId, trimmed, parentId)
        setLocalSections((cur) => cur.map((s) => (s.id === tempId ? { ...s, id: sectionId } : s)))
      } catch {
        setLocalSections(prevSections)
        setError('Could not add the section. The change was not saved.')
      }
    })
  }

  function renameSectionTo(sectionId: string, name: string) {
    setEditingId(null)
    const trimmed = name.trim()
    const current = localSections.find((s) => s.id === sectionId)
    if (!current || isTemp(sectionId) || !trimmed || trimmed === current.name) return
    const prevSections = localSections
    setLocalSections(localSections.map((s) => (s.id === sectionId ? { ...s, name: trimmed } : s)))
    persist(
      () => renameSectionAction(sectionId, menuId, trimmed),
      () => setLocalSections(prevSections),
      'Could not rename the section. The change was not saved.',
    )
  }

  function removeSection(sectionId: string) {
    if (isTemp(sectionId)) return
    if (!window.confirm('Delete this section? Its drinks move back to Unplaced.')) return
    const prevSections = localSections
    const prevDrinks = localDrinks
    const subIds = localSections.filter((s) => s.parent_section_id === sectionId).map((s) => s.id)
    const removed = new Set([sectionId, ...subIds])
    setLocalSections(localSections.filter((s) => !removed.has(s.id)))
    setLocalDrinks(localDrinks.map((d) => (d.section_id !== null && removed.has(d.section_id) ? { ...d, section_id: null } : d)))
    persist(
      () => deleteSectionAction(sectionId, menuId),
      () => {
        setLocalSections(prevSections)
        setLocalDrinks(prevDrinks)
      },
      'Could not delete the section. The change was not saved.',
    )
  }

  function dropHandlers(key: string, targetSectionId: string | null) {
    return {
      onDragOver: (e: DragEvent) => {
        e.preventDefault()
        if (dropKey !== key) setDropKey(key)
      },
      onDragLeave: () => setDropKey((k) => (k === key ? null : k)),
      onDrop: (e: DragEvent) => {
        e.preventDefault()
        setDropKey(null)
        const id = e.dataTransfer.getData('text/plain')
        if (id) moveDrinkTo(id, targetSectionId)
      },
    }
  }

  const ring = (key: string) => (dropKey === key ? 'ring-2 ring-emerald-400' : '')

  const logoAlignClass =
    localLogoAlign === 'center' ? 'justify-center' :
    localLogoAlign === 'right' ? 'justify-end' : 'justify-start'

  const logoSrc = `${localLogoR2Key ? `/api/pouriq/menus/${menuId}/logo` : ''}${logoVersion > 0 ? `?v=${logoVersion}` : menuUpdatedAt ? `?v=${encodeURIComponent(menuUpdatedAt)}` : ''}`

  return (
    <>
      {/* Controls — never printed */}
      <div className="no-print mb-8 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <label htmlFor="menu-title" className="block text-xs font-medium text-slate-700 mb-2">Menu title</label>
          <input
            id="menu-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={INPUT}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="menu-theme" className="block text-xs font-medium text-slate-700 mb-2">Theme</label>
            <select
              id="menu-theme"
              value={localTheme}
              onChange={(e) => handleThemeChange(e.target.value as MenuTheme)}
              disabled={isPending}
              className={INPUT}
            >
              {MENU_THEMES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 mb-2">Logo</span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer text-xs text-emerald-700 hover:text-emerald-800 underline">
                {localLogoR2Key ? 'Replace logo' : 'Upload logo'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleLogoUpload(f)
                    e.target.value = ''
                  }}
                />
              </label>
              {localLogoR2Key && (
                <>
                  <span className="text-xs text-slate-400">Align:</span>
                  {(['left', 'center', 'right'] as LogoAlign[]).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => handleLogoAlignChange(a)}
                      disabled={isPending}
                      className={localLogoAlign === a ? PRIMARY_BUTTON : SECONDARY_BUTTON_SM}
                    >
                      {a.charAt(0).toUpperCase() + a.slice(1)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={isPending}
                    className="text-xs text-rose-600 hover:text-rose-700 underline"
                  >
                    Remove logo
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-700">Layout:</span>
            <button type="button" onClick={() => setColumns(1)} className={columns === 1 ? PRIMARY_BUTTON : SECONDARY_BUTTON_SM}>1 column</button>
            <button type="button" onClick={() => setColumns(2)} className={columns === 2 ? PRIMARY_BUTTON : SECONDARY_BUTTON_SM}>2 columns</button>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} />
            Show prices
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={showDescriptions} onChange={(e) => setShowDescriptions(e.target.checked)} />
            Show descriptions
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={showPhotos} onChange={(e) => setShowPhotos(e.target.checked)} />
            Show photos
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={showAllergens} onChange={(e) => setShowAllergens(e.target.checked)} />
            Show allergens
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={showAbv} onChange={(e) => setShowAbv(e.target.checked)} />
            Show ABV
          </label>
          <button type="button" onClick={() => window.print()} className={`${PRIMARY_BUTTON} ml-auto`}>
            Save as PDF
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Save as PDF opens your browser&rsquo;s print dialog. Choose &ldquo;Save as PDF&rdquo; as the destination.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Arrange pane — never printed */}
        <div className="no-print space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Arrange</h2>
            {isPending && <span className="text-xs text-slate-400">Saving&hellip;</span>}
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}

          {/* Unplaced tray */}
          <div
            {...dropHandlers(UNPLACED_KEY, null)}
            className={`rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 ${ring(UNPLACED_KEY)}`}
          >
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Unplaced</h3>
            {unplaced.length === 0 ? (
              <p className="text-xs text-slate-400">Every drink is in a section.</p>
            ) : (
              <div className="space-y-2">
                {unplaced.map((d, i) => (
                  <ArrangeDrink
                    key={d.id}
                    drink={d}
                    index={i}
                    isFirst={i === 0}
                    isLast={i === unplaced.length - 1}
                    sectionOptions={sectionOptions}
                    onMove={moveDrinkTo}
                    onDropAt={reorderDrinkAt}
                    onMoveUp={() => reorderDrinkAt(d.id, i - 1, d.section_id)}
                    onMoveDown={() => reorderDrinkAt(d.id, i + 1, d.section_id)}
                    disabled={isPending}
                  />
                ))}
              </div>
            )}
          </div>

          {topSections.map(({ section, drinks: direct, subSections }, topIdx) => {
            const topSiblings = topSections.map((t) => t.section)
            return (
              <div
                key={section.id}
                {...dropHandlers(section.id, section.id)}
                className={`rounded-xl border border-slate-200 bg-white p-4 ${ring(section.id)}`}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  {editingId === section.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => renameSectionTo(section.id, editName)}
                      onKeyDown={(e) => { if (e.key === 'Enter') renameSectionTo(section.id, editName) }}
                      className="flex-1 text-sm font-bold text-slate-900 border border-slate-300 rounded-md px-2 py-1"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setEditingId(section.id); setEditName(section.name) }}
                      className="flex-1 text-left text-sm font-bold text-slate-900 hover:text-emerald-700"
                    >
                      {section.name}
                    </button>
                  )}
                  <div className="flex items-center gap-1 shrink-0 text-xs">
                    <button type="button" onClick={() => reorderSibling(topSiblings, section.id, 'up')} disabled={topIdx === 0} className="px-1.5 py-1 text-slate-500 hover:text-slate-800 disabled:opacity-30" aria-label="Move section up">↑</button>
                    <button type="button" onClick={() => reorderSibling(topSiblings, section.id, 'down')} disabled={topIdx === topSections.length - 1} className="px-1.5 py-1 text-slate-500 hover:text-slate-800 disabled:opacity-30" aria-label="Move section down">↓</button>
                    <button type="button" onClick={() => setAddingSubFor(addingSubFor === section.id ? null : section.id)} className="px-1.5 py-1 text-emerald-700 hover:text-emerald-800">+ sub-section</button>
                    <button type="button" onClick={() => removeSection(section.id)} className="px-1.5 py-1 text-rose-600 hover:text-rose-700">Delete</button>
                  </div>
                </div>

                {direct.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {direct.map((d, i) => (
                      <ArrangeDrink
                        key={d.id}
                        drink={d}
                        index={i}
                        isFirst={i === 0}
                        isLast={i === direct.length - 1}
                        sectionOptions={sectionOptions}
                        onMove={moveDrinkTo}
                        onDropAt={reorderDrinkAt}
                        onMoveUp={() => reorderDrinkAt(d.id, i - 1, d.section_id)}
                        onMoveDown={() => reorderDrinkAt(d.id, i + 1, d.section_id)}
                        disabled={isPending}
                      />
                    ))}
                  </div>
                )}

                {addingSubFor === section.id && (
                  <form
                    onSubmit={(e) => { e.preventDefault(); addSection(section.id, subName); setSubName(''); setAddingSubFor(null) }}
                    className="flex gap-2 mb-3"
                  >
                    <input
                      autoFocus
                      value={subName}
                      onChange={(e) => setSubName(e.target.value)}
                      placeholder="Sub-section name"
                      className="flex-1 text-xs border border-slate-300 rounded-md px-2 py-1.5"
                    />
                    <button type="submit" className={SECONDARY_BUTTON_SM}>Add</button>
                  </form>
                )}

                {subSections.map(({ section: sub, drinks: subDrinks }, subIdx) => (
                  <div
                    key={sub.id}
                    {...dropHandlers(sub.id, sub.id)}
                    className={`mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 ${ring(sub.id)}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      {editingId === sub.id ? (
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={() => renameSectionTo(sub.id, editName)}
                          onKeyDown={(e) => { if (e.key === 'Enter') renameSectionTo(sub.id, editName) }}
                          className="flex-1 text-xs font-semibold text-slate-700 border border-slate-300 rounded-md px-2 py-1"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setEditingId(sub.id); setEditName(sub.name) }}
                          className="flex-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-emerald-700"
                        >
                          {sub.name}
                        </button>
                      )}
                      <div className="flex items-center gap-1 shrink-0 text-xs">
                        <button type="button" onClick={() => reorderSibling(subSections.map((s) => s.section), sub.id, 'up')} disabled={subIdx === 0} className="px-1.5 py-1 text-slate-500 hover:text-slate-800 disabled:opacity-30" aria-label="Move sub-section up">↑</button>
                        <button type="button" onClick={() => reorderSibling(subSections.map((s) => s.section), sub.id, 'down')} disabled={subIdx === subSections.length - 1} className="px-1.5 py-1 text-slate-500 hover:text-slate-800 disabled:opacity-30" aria-label="Move sub-section down">↓</button>
                        <button type="button" onClick={() => removeSection(sub.id)} className="px-1.5 py-1 text-rose-600 hover:text-rose-700">Delete</button>
                      </div>
                    </div>
                    {subDrinks.length === 0 ? (
                      <p className="text-xs text-slate-400">Drop a drink here.</p>
                    ) : (
                      <div className="space-y-2">
                        {subDrinks.map((d, i) => (
                          <ArrangeDrink
                            key={d.id}
                            drink={d}
                            index={i}
                            isFirst={i === 0}
                            isLast={i === subDrinks.length - 1}
                            sectionOptions={sectionOptions}
                            onMove={moveDrinkTo}
                            onDropAt={reorderDrinkAt}
                            onMoveUp={() => reorderDrinkAt(d.id, i - 1, d.section_id)}
                            onMoveDown={() => reorderDrinkAt(d.id, i + 1, d.section_id)}
                            disabled={isPending}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })}

          <form
            onSubmit={(e) => { e.preventDefault(); addSection(null, newTop); setNewTop('') }}
            className="flex gap-2"
          >
            <input
              value={newTop}
              onChange={(e) => setNewTop(e.target.value)}
              placeholder="New section name"
              className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2"
            />
            <button type="submit" className={SECONDARY_BUTTON_SM}>Add section</button>
          </form>
        </div>

        {/* Preview pane — this is what prints */}
        <article className={`font-serif rounded-xl print:rounded-none p-6 print:p-0 ${tok.page}`}>
          {localLogoR2Key && (
            <div className={`mb-6 flex ${logoAlignClass}`}>
              <img
                src={logoSrc}
                alt=""
                className="h-16 max-w-[240px] object-contain"
              />
            </div>
          )}
          <h2 className={`text-3xl md:text-4xl text-center mb-8 ${tok.title}`}>{title}</h2>
          {!hasPreview ? (
            <p className="text-slate-500 text-center text-sm no-print">This menu has no placed drinks yet.</p>
          ) : (
            <div className={columns === 2 ? 'sm:columns-2 sm:gap-12' : ''}>
              {topSections.map(({ section, drinks: direct, subSections }) => {
                if (direct.length === 0 && subSections.every((s) => s.drinks.length === 0)) return null
                return (
                  <section key={section.id} className="mb-8 break-inside-avoid">
                    <h3 className={`text-2xl pb-2 mb-4 ${tok.section}`}>{section.name}</h3>
                    {direct.map((d) => (
                      <DrinkPreview key={d.id} drink={d} showPrices={showPrices} showDescriptions={showDescriptions} showPhotos={showPhotos} showAllergens={showAllergens} allergenInfo={allergenInfoById[d.id]} showAbv={showAbv} abvInfo={abvById[d.id]} tok={tok} />
                    ))}
                    {subSections.map(({ section: sub, drinks: subDrinks }) => (
                      subDrinks.length === 0 ? (
                        <Fragment key={sub.id} />
                      ) : (
                        <div key={sub.id} className="mt-4">
                          <h4 className={`text-sm mb-3 ${tok.sub}`}>{sub.name}</h4>
                          {subDrinks.map((d) => (
                            <DrinkPreview key={d.id} drink={d} showPrices={showPrices} showDescriptions={showDescriptions} showPhotos={showPhotos} showAllergens={showAllergens} allergenInfo={allergenInfoById[d.id]} showAbv={showAbv} abvInfo={abvById[d.id]} tok={tok} />
                          ))}
                        </div>
                      )
                    ))}
                  </section>
                )
              })}
            </div>
          )}
        </article>
      </div>
    </>
  )
}
