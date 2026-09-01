'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils/formatting'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'

interface EmployeeRow {
  cashier_id: string
  name: string
  revenue: number
  transactions: number
  commission: number
}

export function EmployeeReport({ outletId }: { outletId: string }) {
  const [rows, setRows] = useState<EmployeeRow[]>([])
  const [days, setDays] = useState(30)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/reports/sales-breakdown?outlet_id=${outletId}&days=${days}`)
    const data = await res.json()
    if (res.ok) setRows(data.cashierSales ?? [])
    setIsLoading(false)
  }, [outletId, days])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md border border-gray-200 p-1 w-fit">
          {[30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded px-3 py-1 text-sm font-medium ${days === d ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {d} Hari
            </button>
          ))}
        </div>
        <ExportCsvButton filename={`employee-report-${days}hari`} rows={rows} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Karyawan</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Transaksi Ditangani</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Total Penjualan</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Komisi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Belum ada transaksi</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.cashier_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{r.name}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{r.transactions}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(r.revenue)}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(r.commission)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
