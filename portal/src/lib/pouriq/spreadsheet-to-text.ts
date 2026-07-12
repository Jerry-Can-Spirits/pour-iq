// Convert a CSV or XLSX File to plain text we can send to Claude via the
// existing /api/pouriq/import/extract text path. read-excel-file is
// dynamically imported so the bundle only loads on the import page.

const MAX_BYTES = 5 * 1024 * 1024

function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

export async function spreadsheetToText(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error('File exceeds 5MB limit')
  const lower = file.name.toLowerCase()

  if (lower.endsWith('.csv')) {
    const text = await file.text()
    if (!text.trim()) throw new Error('CSV file is empty')
    return text
  }

  if (lower.endsWith('.xlsx')) {
    const readXlsxFile = (await import('read-excel-file/browser')).default
    const sheets = await readXlsxFile(file)
    const blocks: string[] = []
    for (const sheet of sheets) {
      const lines: string[] = []
      for (const row of sheet.data) {
        const cells = row.map((c) => csvEscape(cellToString(c)))
        while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop()
        if (cells.length > 0) lines.push(cells.join(','))
      }
      if (lines.length > 0) blocks.push(`--- Sheet: ${sheet.sheet} ---\n${lines.join('\n')}`)
    }
    if (blocks.length === 0) throw new Error('Spreadsheet has no readable rows')
    return blocks.join('\n\n')
  }

  throw new Error('Only .csv and .xlsx files are accepted')
}
