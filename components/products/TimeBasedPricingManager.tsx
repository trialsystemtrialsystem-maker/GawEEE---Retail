'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Product {
  id: string
  name: string
  selling_price: number
}
interface TimeBasedPrice {
  id: string
  product_id: string
  price: number
  day_of_week: number | null
  start_time: string
  end_time: string
  products: { name: string; selling_price: number } | null
}

const DAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

// POS checks these at add-time and applies the price gap as a per-item
// discount — zero create_invoice() changes. See Phase 13 Batch C item 8.
export function TimeBasedPricingManager() {
  const [prices, setPrices] = useState<TimeBasedPrice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [productId, setProductId] = useState('')
  const [price, setPrice] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [priceRes, productRes] = await Promise.all([fetch('/api/time-based-prices'), fetch('/api/products?limit=200')])
    const priceData = await priceRes.json()
    const productData = await productRes.json()
    if (priceRes.ok) setPrices(priceData.prices ?? [])
    if (productRes.ok) setProducts(productData.data ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/time-based-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          price: Number(price),
          day_of_week: dayOfWeek === '' ? undefined : Number(dayOfWeek),
          start_time: startTime,
          end_time: endTime,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal menambah harga waktu tertentu', 'danger')
        return
      }
      setProductId('')
      setPrice('')
      setDayOfWeek('')
      setStartTime('')
      setEndTime('')
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(tbp: TimeBasedPrice) {
    setBusyId(tbp.id)
    try {
      await fetch(`/api/time-based-prices/${tbp.id}`, { method: 'DELETE' })
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
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
        <Input label="Harga Khusus (Rp)" type="number" min="0" required value={price} onChange={(e) => setPrice(e.target.value)} className="w-36" />
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Hari</label>
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value)}
            className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Setiap hari</option>
            {DAY_LABELS.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <Input label="Mulai" type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <Input label="Selesai" type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        <Button type="submit" isLoading={isSubmitting}>
          + Tambah
        </Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Harga Normal</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Harga Khusus</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Hari</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Jam</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : prices.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Belum ada harga berbasis waktu</td></tr>
            ) : (
              prices.map((tbp) => (
                <tr key={tbp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{tbp.products?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(tbp.products?.selling_price ?? 0)}</td>
                  <td className="px-4 py-2 text-right font-medium text-emerald-600">{formatCurrency(tbp.price)}</td>
                  <td className="px-4 py-2 text-gray-600">{tbp.day_of_week === null ? 'Setiap hari' : DAY_LABELS[tbp.day_of_week]}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {tbp.start_time.slice(0, 5)}–{tbp.end_time.slice(0, 5)}
                  </td>
                  <td className="px-4 py-2">
                    <button type="button" disabled={busyId === tbp.id} onClick={() => handleDelete(tbp)} className="text-xs text-red-500 hover:underline disabled:opacity-50">
                      Hapus
                    </button>
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
