'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils/formatting'

interface TurnoverRow {
  product_id: string
  name: string
  cogs_sold: number
  current_stock_value: number
  turnover_ratio: number | null
}

export function StockTurnoverReport({ outletId }: { outletId: string }) {
  const [rows, setRows] = useState<TurnoverRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/reports/stock-turnover?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setRows(data.rows ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk</th>
            <th className="px-4 py-2 text-right font-semibold text-gray-600">HPP Terjual (30 hari)</th>
            <th className="px-4 py-2 text-right font-semibold text-gray-600">Nilai Stok Saat Ini</th>
            <th className="px-4 py-2 text-right font-semibold text-gray-600">Rasio Turnover</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {isLoading ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Belum ada data</td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.product_id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-900">{r.name}</td>
                <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(r.cogs_sold)}</td>
                <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(r.current_stock_value)}</td>
                <td className="px-4 py-2 text-right font-medium text-gray-900">
                  {r.turnover_ratio !== null ? `${r.turnover_ratio}x` : '-'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
