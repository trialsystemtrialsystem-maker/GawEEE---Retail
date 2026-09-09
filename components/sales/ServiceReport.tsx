'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils/formatting'
import { CategoryBreakdownChart } from '@/components/charts/CategoryBreakdownChart'

interface ServiceRow {
  product_id: string
  name: string
  count: number
  revenue: number
}

export function ServiceReport() {
  const [services, setServices] = useState<ServiceRow[]>([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/reports/service')
    const data = await res.json()
    if (res.ok) {
      setServices(data.services ?? [])
      setTotalRevenue(data.totalRevenue ?? 0)
      setTotalCount(data.totalCount ?? 0)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">30 hari terakhir</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Pendapatan Layanan</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Jumlah Terjual</p>
          <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Jenis Layanan Terjual</p>
          <p className="text-2xl font-bold text-gray-900">{services.length}</p>
        </div>
      </div>

      {!isLoading && services.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Pendapatan per Layanan</h3>
          <CategoryBreakdownChart data={services.map((s) => ({ name: s.name, revenue: s.revenue }))} />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Layanan</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Terjual</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Pendapatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : services.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">Belum ada penjualan layanan</td></tr>
            ) : (
              services.map((s) => (
                <tr key={s.product_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{s.name}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{s.count}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(s.revenue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
