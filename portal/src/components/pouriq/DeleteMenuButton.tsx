'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteMenuAction } from '@/lib/pouriq/server-actions'
import { DESTRUCTIVE_BUTTON } from '@/lib/pouriq/button-styles'

interface Props {
  menuId: string
  menuName: string
}

export function DeleteMenuButton({ menuId, menuName }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  async function handleDelete() {
    const confirmed = confirm(
      `Delete "${menuName}"? This removes the menu and all its drinks and analyses. This cannot be undone.`
    )
    if (!confirmed) return
    setSubmitting(true)
    try {
      await deleteMenuAction(menuId)
    } catch {
      setSubmitting(false)
      alert('Could not delete the menu. Please try again.')
    }
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={submitting}
      className={DESTRUCTIVE_BUTTON}
    >
      {submitting ? 'Deleting…' : 'Delete menu'}
    </button>
  )
}
