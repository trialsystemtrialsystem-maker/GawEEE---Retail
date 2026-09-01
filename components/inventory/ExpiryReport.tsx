'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatDate } from '@/lib/utils/formatting'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'

interface Batch {
  id: string
  product_id: string
  batch_number: string | null
  expiry_date: string
  quantity_change: number
  created_at: string
  products: { name: string; sku: string } | null
}

function statusFor(expiryDate: string): { label: string; className: string } {
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return { label: 'Kadaluarsa', className: 'text-red-600' }
  if (days <= 7) return { label: `${days} hari lagi`, className: 'text-amber-600' }
  return { label: 'Aman', className: 'text-emerald-600' }
}

export function ExpiryReport({ outletId }: { outletId: string }) {
  const [batches, setBatches] = useState<Batch[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/inventory/expiry?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setBatches(data.batches ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  const csvRows = batches.map((b) => ({
    produk: b.products?.name ?? b.product_id,
    sku: b.products?.sku ?? '',
    no_batch: b.batch_number ?? '',
    jumlah_diterima: b.quantity_change,
    tanggal_kadaluarsa: b.expiry_date,
    status: statusFor(b.expiry_date).label,
  }))

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportCsvButton filename="laporan-kadaluarsa" rows={csvRows} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">No. Batch</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Jumlah Diterima</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal Kadaluarsa</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : batches.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada batch dengan tanggal kadaluarsa tercatat</td></tr>
            ) : (
              batches.map((b) => {
                const status = statusFor(b.expiry_date)
                return (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{b.products?.name ?? b.product_id}</td>
                    <td className="px-4 py-2 text-gray-600">{b.batch_number ?? '-'}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{b.quantity_change}</td>
                    <td className="px-4 py-2 text-gray-600">{formatDate(b.expiry_date)}</td>
                    <td className={`px-4 py-2 font-medium ${status.className}`}>{status.label}</td>
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
