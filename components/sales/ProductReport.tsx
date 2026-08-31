'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils/formatting'

interface ProductRow {
  product_id: string
  name: string
  quantity: number
  revenue: number
}

export function ProductReport({ outletId }: { outletId: string }) {
  const [rows, setRows] = useState<ProductRow[]>([])
  const [days, setDays] = useState(30)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/reports/sales-breakdown?outlet_id=${outletId}&days=${days}`)
    const data = await res.json()
    if (res.ok) setRows(data.bestProducts ?? [])
    setIsLoading(false)
  }, [outletId, days])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  return (
    <div className="space-y-4">
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

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">#</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Terjual</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Pendapatan</th>
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
              rows.map((r, i) => (
                <tr key={r.product_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-2 text-gray-900">{r.name}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{r.quantity}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(r.revenue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
