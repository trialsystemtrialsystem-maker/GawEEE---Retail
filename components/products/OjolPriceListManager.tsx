'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Product {
  id: string
  name: string
  selling_price: number
}
interface ChannelPrice {
  id: string
  product_id: string
  channel: 'gofood' | 'grabfood' | 'shopeefood' | 'other'
  price: number
  products: { name: string; selling_price: number } | null
}

const CHANNEL_LABELS: Record<ChannelPrice['channel'], string> = {
  gofood: 'GoFood',
  grabfood: 'GrabFood',
  shopeefood: 'ShopeeFood',
  other: 'Lainnya',
}

// Pure reference price list — no live platform integration exists (there's
// no ad/courier API in this app either), so this is a lookup staff consult
// when manually keying a channel order into the existing online-order log.
// See Phase 13 Batch C item 9.
export function OjolPriceListManager() {
  const [prices, setPrices] = useState<ChannelPrice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [productId, setProductId] = useState('')
  const [channel, setChannel] = useState<ChannelPrice['channel']>('gofood')
  const [price, setPrice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [priceRes, productRes] = await Promise.all([fetch('/api/channel-prices'), fetch('/api/products?limit=200')])
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
      const res = await fetch('/api/channel-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, channel, price: Number(price) }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal menyimpan harga', 'danger')
        return
      }
      setProductId('')
      setPrice('')
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(cp: ChannelPrice) {
    setBusyId(cp.id)
    try {
      await fetch(`/api/channel-prices/${cp.id}`, { method: 'DELETE' })
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Alert variant="info">Daftar harga referensi untuk staf saat mencatat pesanan dari platform ojek online secara manual — belum ada integrasi API langsung ke platform manapun.</Alert>

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
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Platform</label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as ChannelPrice['channel'])}
            className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Input label="Harga di Platform (Rp)" type="number" min="0" required value={price} onChange={(e) => setPrice(e.target.value)} className="w-40" />
        <Button type="submit" isLoading={isSubmitting}>
          + Simpan
        </Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Harga Toko</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Platform</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Harga Platform</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : prices.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada harga platform tersimpan</td></tr>
            ) : (
              prices.map((cp) => (
                <tr key={cp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{cp.products?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(cp.products?.selling_price ?? 0)}</td>
                  <td className="px-4 py-2 text-gray-600">{CHANNEL_LABELS[cp.channel]}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(cp.price)}</td>
                  <td className="px-4 py-2">
                    <button type="button" disabled={busyId === cp.id} onClick={() => handleDelete(cp)} className="text-xs text-red-500 hover:underline disabled:opacity-50">
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
