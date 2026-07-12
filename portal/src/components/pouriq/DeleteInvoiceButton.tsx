'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteInvoiceAction } from '@/lib/pouriq/server-actions'
import { DESTRUCTIVE_BUTTON } from '@/lib/pouriq/button-styles'

interface Props {
  invoiceId: string
}

export function DeleteInvoiceButton({ invoiceId }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  async function handleDelete() {
    const confirmed = confirm(
      'Delete this invoice? This removes the record and its PDF, and any stock it added. Prices it already updated stay as they are. This cannot be undone.'
    )
    if (!confirmed) return
    setSubmitting(true)
    try {
      await deleteInvoiceAction(invoiceId)
    } catch {
      setSubmitting(false)
      alert('Could not delete the invoice. Please try again.')
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
      {submitting ? 'Deleting…' : 'Delete invoice'}
    </button>
  )
}
