'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils/formatting'
import { getProductIcon } from '@/lib/utils/productIcon'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'

interface InventoryRow {
  product_id: string
  sku: string
  name: string
  category_name?: string | null
  quantity_on_hand: number
  quantity_available: number
  cost_value: number
  retail_value: number
  status: string
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  normal: { label: 'OK', className: 'text-emerald-600' },
  low_stock: { label: 'Stok Rendah', className: 'text-amber-600' },
  out_of_stock: { label: 'Habis', className: 'text-red-600' },
  overstock: { label: 'Overstock', className: 'text-blue-600' },
}

export function InventoryTable({ outletId }: { outletId: string }) {
  const searchParams = useSearchParams()
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totals, setTotals] = useState({ cost: 0, retail: 0 })

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/inventory/${outletId}?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal memuat inventori')
        return
      }
      setRows(data.inventory ?? [])
      setTotals({ cost: data.total_value_on_hand ?? 0, retail: data.total_retail_value ?? 0 })
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setIsLoading(false)
    }
  }, [outletId, search, statusFilter])

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 gap-3">
          <div className="flex-1">
            <Input
              placeholder="Cari produk…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cari produk"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Status</option>
            <option value="low_stock">Stok Rendah</option>
            <option value="out_of_stock">Habis</option>
            <option value="normal">Normal</option>
          </select>
        </div>
        <div className="text-sm text-gray-600">
          Nilai Stok: {formatCurrency(totals.cost)} · Nilai Jual: {formatCurrency(totals.retail)}
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">SKU</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Stok</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Nilai Stok</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Memuat…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Tidak ada produk ditemukan
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const statusInfo = STATUS_LABEL[row.status] ?? { label: row.status, className: 'text-gray-500' }
                return (
                  <tr key={row.product_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm"
                        >
                          {getProductIcon({ name: row.name, categoryName: row.category_name })}
                        </span>
                        {row.name}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{row.sku}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{row.quantity_available}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(row.cost_value)}</td>
                    <td className={`px-4 py-2 font-medium ${statusInfo.className}`}>{statusInfo.label}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
