'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Product {
  id: string
  name: string
  selling_price: number
}
interface Schedule {
  id: string
  product_id: string
  new_price: number
  effective_date: string
  applied: boolean
  products: { name: string; selling_price: number } | null
}

// No real cron exists in this app — due schedules are applied when this
// page is opened (see apply/route.ts), disclosed below. See Phase 13 Batch
// C item 7.
export function PriceSchedulerManager() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [appliedCount, setAppliedCount] = useState<number | null>(null)
  const [productId, setProductId] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [scheduleRes, productRes] = await Promise.all([fetch('/api/price-schedules'), fetch('/api/products?limit=200')])
    const scheduleData = await scheduleRes.json()
    const productData = await productRes.json()
    if (scheduleRes.ok) setSchedules(scheduleData.schedules ?? [])
    if (productRes.ok) setProducts(productData.data ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(async () => {
      const applyRes = await fetch('/api/price-schedules/apply', { method: 'POST' })
      const applyData = await applyRes.json()
      if (applyRes.ok) setAppliedCount(applyData.applied_count ?? 0)
      load()
    }, 0)
    return () => clearTimeout(t)
  }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/price-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, new_price: Number(newPrice), effective_date: effectiveDate }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal menjadwalkan harga', 'danger')
        return
      }
      setProductId('')
      setNewPrice('')
      setEffectiveDate('')
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(schedule: Schedule) {
    setBusyId(schedule.id)
    try {
      await fetch(`/api/price-schedules/${schedule.id}`, { method: 'DELETE' })
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Alert variant="info">
        Jadwal harga diterapkan otomatis saat halaman ini dibuka — bukan cron real-time. Buka halaman ini di hari H untuk memastikan harga berubah.
      </Alert>
      {appliedCount !== null && appliedCount > 0 && <Alert variant="success">{appliedCount} jadwal harga baru saja diterapkan.</Alert>}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 p-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Produk</label>
          <select
            required
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="min-w-[200px] rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Pilih produk…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({formatCurrency(p.selling_price)})
              </option>
            ))}
          </select>
        </div>
        <Input label="Harga Baru (Rp)" type="number" min="0" required value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className="w-36" />
        <Input label="Berlaku Mulai" type="date" required value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
        <Button type="submit" isLoading={isSubmitting}>
          + Jadwalkan
        </Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Harga Saat Ini</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Harga Baru</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Berlaku</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : schedules.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Belum ada jadwal harga</td></tr>
            ) : (
              schedules.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{s.products?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(s.products?.selling_price ?? 0)}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(s.new_price)}</td>
                  <td className="px-4 py-2 text-gray-600">{formatDate(s.effective_date)}</td>
                  <td className="px-4 py-2">
                    {s.applied ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Sudah diterapkan</span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Menunggu</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {!s.applied && (
                      <button type="button" disabled={busyId === s.id} onClick={() => handleDelete(s)} className="text-xs text-red-500 hover:underline disabled:opacity-50">
                        Batalkan
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
