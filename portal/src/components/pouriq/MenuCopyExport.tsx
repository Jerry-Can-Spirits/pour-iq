'use client'

import { useState } from 'react'
import { SECONDARY_BUTTON } from '@/lib/pouriq/button-styles'

interface Drink {
  name: string
  description: string | null
  sale_price_p: number | null
}

interface Props {
  menuName: string
  drinks: Drink[]
}

function formatPlainText(menuName: string, drinks: Drink[]): string {
  const lines: string[] = []
  lines.push(menuName.toUpperCase())
  lines.push('')
  for (const d of drinks) {
    const price = d.sale_price_p ? ` — £${(d.sale_price_p / 100).toFixed(2)}` : ''
    lines.push(`${d.name.toUpperCase()}${price}`)
    if (d.description) lines.push(d.description)
    else lines.push('(no description)')
    lines.push('')
  }
  return lines.join('\n').trimEnd() + '\n'
}

function formatMarkdown(menuName: string, drinks: Drink[]): string {
  const lines: string[] = []
  lines.push(`# ${menuName}`)
  lines.push('')
  for (const d of drinks) {
    const price = d.sale_price_p ? ` *£${(d.sale_price_p / 100).toFixed(2)}*` : ''
    lines.push(`## ${d.name}${price}`)
    if (d.description) lines.push(d.description)
    else lines.push('*(no description)*')
    lines.push('')
  }
  return lines.join('\n').trimEnd() + '\n'
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function MenuCopyExport({ menuName, drinks }: Props) {
  const [copied, setCopied] = useState<'txt' | 'md' | null>(null)

  async function copyTo(format: 'txt' | 'md') {
    const content = format === 'txt' ? formatPlainText(menuName, drinks) : formatMarkdown(menuName, drinks)
    try {
      await navigator.clipboard.writeText(content)
      setCopied(format)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Clipboard may not be available; fall back to download.
      download(`menu-copy.${format}`, content, format === 'txt' ? 'text/plain' : 'text/markdown')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => copyTo('txt')} className={SECONDARY_BUTTON}>
          {copied === 'txt' ? 'Copied' : 'Copy as plain text'}
        </button>
        <button type="button" onClick={() => copyTo('md')} className={SECONDARY_BUTTON}>
          {copied === 'md' ? 'Copied' : 'Copy as markdown'}
        </button>
        <button
          type="button"
          onClick={() => download('menu-copy.txt', formatPlainText(menuName, drinks), 'text/plain')}
          className={SECONDARY_BUTTON}
        >
          Download .txt
        </button>
        <button
          type="button"
          onClick={() => download('menu-copy.md', formatMarkdown(menuName, drinks), 'text/markdown')}
          className={SECONDARY_BUTTON}
        >
          Download .md
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <pre className="whitespace-pre-wrap text-sm text-slate-900 font-sans">
{formatPlainText(menuName, drinks)}
        </pre>
      </div>
    </div>
  )
}
