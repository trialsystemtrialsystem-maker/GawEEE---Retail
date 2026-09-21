'use client'

import { useEffect, useState, useCallback } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { DateRangePicker, defaultDateRange, type DateRange } from '@/components/ui/DateRangePicker'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'

interface SettlementRow {
  date: string
  settled: number
  pending: number
}

export function SettlementReport({ outletId }: { outletId?: string }) {
  const [rows, setRows] = useState<SettlementRow[]>([])
  const [unsettledTotal, setUnsettledTotal] = useState(0)
  const [range, setRange] = useState<DateRange>(() => defaultDateRange(30))
  const [selectedOutlet, setSelectedOutlet] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const effectiveOutlet = outletId ?? selectedOutlet

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/reports/settlement-report?outlet_id=${effectiveOutlet}&start=${range.start}&end=${range.end}`)
    const data = await res.json()
    if (res.ok) {
      setRows(data.rows ?? [])
      setUnsettledTotal(data.unsettledTotal ?? 0)
    }
    setIsLoading(false)
  }, [effectiveOutlet, range])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {!outletId && <OutletSelector value={selectedOutlet} onChange={setSelectedOutlet} />}
          <DateRangePicker value={range} onChange={setRange} />
        </div>
        <ExportCsvButton filename="settlement-report" rows={rows} />
      </div>

      {unsettledTotal > 0 && (
        <Alert variant="warning">{formatCurrency(unsettledTotal)} pembayaran masih pending/belum settle.</Alert>
      )}
      <Card>
        <p className="text-sm text-gray-500">Total Settle (Periode Terpilih)</p>
        <p className="mt-1 text-xl font-bold text-emerald-600">
          {formatCurrency(rows.reduce((s, r) => s + r.settled, 0))}
        </p>
      </Card>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal Settle</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Jumlah</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-gray-400">Belum ada settlement</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.date} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{formatDate(r.date)}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(r.settled)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
