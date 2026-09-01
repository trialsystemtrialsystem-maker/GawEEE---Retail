'use client'

import { exportToCsv } from '@/lib/utils/exportCsv'

export function ExportCsvButton({ filename, rows }: { filename: string; rows: object[] }) {
  return (
    <button
      type="button"
      onClick={() => exportToCsv(filename, rows)}
      disabled={rows.length === 0}
      className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      ⬇ Export CSV
    </button>
  )
}
