'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { CategoryBreakdownChart } from '@/components/charts/CategoryBreakdownChart'

interface CustomerRow {
  key: string
  customer_id: string | null
  name: string
  phone: string | null
  total_spend: number
  visit_count: number
  last_visit: string
}

export function CustomerSummaryReport({ outletId }: { outletId: string }) {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [matchNote, setMatchNote] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/reports/customer-summary?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) {
      setCustomers(data.customers ?? [])
      setMatchNote(data.matchNote ?? '')
    }
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const topSpenders = customers.slice(0, 10).map((c) => ({ name: c.name, revenue: c.total_spend }))

  return (
    <div className="space-y-4">
      {matchNote && <p className="text-xs text-gray-400">{matchNote}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Pelanggan Aktif</p>
          <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Belanja</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(customers.reduce((s, c) => s + c.total_spend, 0))}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Rata-rata per Pelanggan</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(customers.length > 0 ? customers.reduce((s, c) => s + c.total_spend, 0) / customers.length : 0)}
          </p>
        </div>
      </div>

      {!isLoading && topSpenders.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Top 10 Pelanggan (Total Belanja)</h3>
          <CategoryBreakdownChart data={topSpenders} />
        </div>
      )}

      <div className="flex justify-end">
        <ExportCsvButton filename="customer-summary" rows={customers} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Pelanggan</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Telepon</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Kunjungan</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Total Belanja</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Kunjungan Terakhir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada transaksi dengan nama pelanggan</td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.key} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{c.name}</td>
                  <td className="px-4 py-2 text-gray-600">{c.phone ?? '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{c.visit_count}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(c.total_spend)}</td>
                  <td className="px-4 py-2 text-gray-600">{formatDateTime(c.last_visit)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
