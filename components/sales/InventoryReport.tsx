'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils/formatting'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'

interface ValuationRow {
  product_id: string
  name: string
  sku: string
  quantity_on_hand: number
  cost_value: number
  retail_value: number
  potential_profit: number
}

export function InventoryReport({ outletId }: { outletId: string }) {
  const [rows, setRows] = useState<ValuationRow[]>([])
  const [totals, setTotals] = useState({ cost_value: 0, retail_value: 0, potential_profit: 0 })
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/reports/inventory-report?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) {
      setRows(data.items ?? [])
      setTotals(data.totals ?? { cost_value: 0, retail_value: 0, potential_profit: 0 })
    }
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportCsvButton filename="inventory-report" rows={rows} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">Nilai Modal</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(totals.cost_value)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Nilai Jual</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(totals.retail_value)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Potensi Keuntungan</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">{formatCurrency(totals.potential_profit)}</p>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Stok</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Nilai Modal</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Nilai Jual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Belum ada produk</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.product_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{r.name}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{r.quantity_on_hand}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(r.cost_value)}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(r.retail_value)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
