'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Detail {
  id: string
  product_id: string
  expected_quantity: number
  counted_quantity: number
  variance: number
  products: { name: string; sku: string } | null
}

interface Session {
  id: string
  status: string
  scheduled_date: string
  total_variance_value: number | null
}

export function StocktakeDetail({ stocktakeId, canManage }: { stocktakeId: string; canManage: boolean }) {
  const [session, setSession] = useState<Session | null>(null)
  const [details, setDetails] = useState<Detail[]>([])
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/stocktakes/${stocktakeId}`)
    const data = await res.json()
    if (res.ok) {
      setSession(data.stocktake)
      setDetails(data.details ?? [])
      setCounts(Object.fromEntries((data.details ?? []).map((d: Detail) => [d.id, String(d.counted_quantity)])))
    }
    setIsLoading(false)
  }, [stocktakeId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  const isOpen = session?.status === 'draft' || session?.status === 'in_progress'
  const totalVarianceUnits = details.reduce((s, d) => s + (Number(counts[d.id] ?? d.counted_quantity) - d.expected_quantity), 0)

  async function saveCounts() {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/stocktakes/${stocktakeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counts: details.map((d) => ({ detail_id: d.id, counted_quantity: Number(counts[d.id]) || 0 })),
        }),
      })
      if (res.ok) {
        showToast('Jumlah hitung tersimpan', 'success')
        load()
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function submit() {
    setIsSubmitting(true)
    try {
      await saveCounts()
      const res = await fetch(`/api/stocktakes/${stocktakeId}/submit`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal menyelesaikan stok opname', 'danger')
        return
      }
      showToast('Stok opname selesai, stok telah disesuaikan', 'success')
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/inventory/stocktake" className="text-sm text-blue-600 hover:text-blue-700">
        ← Kembali ke Daftar Stok Opname
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">Detail Stok Opname</h1>

      {isLoading ? (
        <p className="text-sm text-gray-400">Memuat…</p>
      ) : !session ? (
        <Alert variant="danger">Sesi tidak ditemukan</Alert>
      ) : (
        <>
          {!isOpen && (
            <Alert variant="info">
              Sesi ini sudah selesai. Total selisih: {formatCurrency(session.total_variance_value ?? 0)}
            </Alert>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Stok Sistem</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Hasil Hitung</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {details.map((d) => {
                  const counted = Number(counts[d.id] ?? d.counted_quantity)
                  const variance = counted - d.expected_quantity
                  return (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900">{d.products?.name ?? '-'}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{d.expected_quantity}</td>
                      <td className="px-4 py-2 text-right">
                        {isOpen && canManage ? (
                          <input
                            type="number"
                            min="0"
                            value={counts[d.id] ?? ''}
                            onChange={(e) => setCounts((c) => ({ ...c, [d.id]: e.target.value }))}
                            className="w-24 rounded-sm border border-gray-200 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="text-gray-700">{d.counted_quantity}</span>
                        )}
                      </td>
                      <td className={`px-4 py-2 text-right font-medium ${variance === 0 ? 'text-gray-500' : variance > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {variance > 0 ? `+${variance}` : variance}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {isOpen && canManage && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Total selisih unit: {totalVarianceUnits}</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={saveCounts} isLoading={isSaving}>
                  Simpan Hitungan
                </Button>
                <Button onClick={submit} isLoading={isSubmitting}>
                  Selesaikan &amp; Sesuaikan Stok
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
