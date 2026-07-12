'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setActiveMenuAction } from '@/lib/pouriq/server-actions'
import { SECONDARY_BUTTON_SM } from '@/lib/pouriq/button-styles'

export function MakeActiveButton({ menuId }: { menuId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState(false)

  function activate(e: React.MouseEvent) {
    // The card is often wrapped in a link; don't navigate when activating.
    e.preventDefault()
    e.stopPropagation()
    setError(false)
    startTransition(async () => {
      try {
        await setActiveMenuAction(menuId)
        router.refresh()
      } catch {
        setError(true)
      }
    })
  }

  return (
    <button type="button" onClick={activate} disabled={pending} className={SECONDARY_BUTTON_SM}>
      {pending ? 'Setting…' : error ? 'Try again' : 'Make active'}
    </button>
  )
}
