'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cloneMenuAction } from '@/lib/pouriq/server-actions'
import { SECONDARY_BUTTON_SM } from '@/lib/pouriq/button-styles'

interface Props {
  menuId: string
  menuName: string
}

export function DuplicateMenuButton({ menuId, menuName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState(`Copy of ${menuName}`)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function go() {
    setError(null)
    startTransition(async () => {
      try {
        const { menuId: newId } = await cloneMenuAction(menuId, newName.trim())
        router.push(`/${newId}`)
        router.refresh()
      } catch (e) {
        setError((e as Error).message || 'Could not duplicate menu')
      }
    })
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={SECONDARY_BUTTON_SM}>
        Duplicate menu
      </button>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 min-w-[260px]">
      <label htmlFor="dup-name" className="block text-xs font-medium text-slate-600">New menu name</label>
      <input
        id="dup-name"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-sm text-slate-900 text-sm focus:border-emerald-500 focus:outline-hidden"
        placeholder="e.g. Summer 2026"
        autoFocus
      />
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">
          Cancel
        </button>
        <button type="button" onClick={go} disabled={pending || !newName.trim()} className={SECONDARY_BUTTON_SM}>
          {pending ? 'Duplicating…' : 'Duplicate'}
        </button>
      </div>
    </div>
  )
}
