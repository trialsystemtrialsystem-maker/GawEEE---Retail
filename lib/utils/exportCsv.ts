/** Client-side CSV export — array of objects to a downloaded .csv file that
 * opens directly in Excel. No backend/dependency needed. Accepts any
 * object-shaped row (not just `Record<string, unknown>`) since most callers
 * pass state typed as an `interface`, which TS doesn't give an implicit
 * index signature — same reasoning as this codebase's Supabase Row types. */
export function exportToCsv(filename: string, rows: object[]) {
  if (rows.length === 0) return

  const dataRows = rows as Record<string, unknown>[]
  const headers = Object.keys(dataRows[0])
  const escape = (value: unknown) => {
    const s = value === null || value === undefined ? '' : String(value)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }

  const csv = [headers.join(','), ...dataRows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\r\n')

  // BOM so Excel opens UTF-8 (Rp, é, etc.) correctly instead of mangling it.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
