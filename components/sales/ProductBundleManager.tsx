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
interface BundleItem {
  id: string
  product_id: string
  quantity: number
  products: { name: string; sku: string; selling_price: number } | null
}
interface Bundle {
  id: string
  name: string
  bundle_price: number
  product_bundle_items: BundleItem[]
}
interface DraftLine {
  product_id: string
  quantity: number
}

export function ProductBundleManager({ outletId }: { outletId: string }) {
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [bundlePrice, setBundlePrice] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([{ product_id: '', quantity: 1 }])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [bundleRes, productRes] = await Promise.all([
      fetch(`/api/product-bundles?outlet_id=${outletId}`),
      fetch('/api/products?limit=200'),
    ])
    const bundleData = await bundleRes.json()
    const productData = await productRes.json()
    if (bundleRes.ok) setBundles(bundleData.bundles ?? [])
    if (productRes.ok) setProducts(productData.data ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }
  function addLine() {
    setLines((ls) => [...ls, { product_id: '', quantity: 1 }])
  }
  function removeLine(index: number) {
    setLines((ls) => ls.filter((_, i) => i !== index))
  }

  const normalTotal = lines.reduce((sum, l) => {
    const product = products.find((p) => p.id === l.product_id)
    return sum + (product?.selling_price ?? 0) * l.quantity
  }, 0)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const validLines = lines.filter((l) => l.product_id && l.quantity > 0)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/product-bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, name, bundle_price: Number(bundlePrice), items: validLines }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal membuat paket', 'danger')
        return
      }
      showToast('Paket bundling tersimpan', 'success')
      setName('')
      setBundlePrice('')
      setLines([{ product_id: '', quantity: 1 }])
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(bundle: Bundle) {
    const ok = window.confirm(`Nonaktifkan paket "${bundle.name}"?`)
    if (!ok) return
    setBusyId(bundle.id)
    try {
      await fetch(`/api/product-bundles/${bundle.id}`, { method: 'DELETE' })
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Buat Paket'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Nama Paket" required value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Paket Hemat Frozen" />
            <Input label="Harga Paket (Rp)" type="number" min="0" required value={bundlePrice} onChange={(e) => setBundlePrice(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Produk dalam Paket</label>
            {lines.map((line, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <select
                  value={line.product_id}
                  onChange={(e) => updateLine(i, { product_id: e.target.value })}
                  className="min-w-[180px] flex-1 rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Pilih produk…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatCurrency(p.selling_price)})
                    </option>
                  ))}
                </select>
                <Input type="number" min={1} className="w-24" value={line.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(i)}>
                  Hapus
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={addLine}>
              + Tambah Produk
            </Button>
          </div>

          {normalTotal > 0 && (
            <p className="text-sm text-gray-500">
              Total harga normal: {formatCurrency(normalTotal)}
              {Number(bundlePrice) > 0 && (
                <> — hemat {formatCurrency(Math.max(0, normalTotal - Number(bundlePrice)))}</>
              )}
            </p>
          )}

          <Button type="submit" isLoading={isSubmitting}>
            Simpan Paket
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Nama Paket</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Isi</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Harga Paket</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : bundles.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Belum ada paket bundling</td></tr>
            ) : (
              bundles.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{b.name}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {b.product_bundle_items.map((it) => `${it.products?.name ?? '?'} x${it.quantity}`).join(', ')}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(b.bundle_price)}</td>
                  <td className="px-4 py-2">
                    <Button size="sm" variant="ghost" isLoading={busyId === b.id} onClick={() => handleDelete(b)}>
                      Nonaktifkan
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && bundles.length === 0 && (
        <Alert variant="info">Buat minimal satu paket di atas agar tombol &ldquo;Tambah Paket&rdquo; muncul di Kasir.</Alert>
      )}
    </div>
  )
}
