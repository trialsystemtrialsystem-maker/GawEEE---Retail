'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Group {
  id: string
  name: string
}
interface Product {
  id: string
  name: string
  selling_price: number
}
interface SpecialPrice {
  id: string
  price: number
  customer_groups: { name: string } | null
  products: { name: string } | null
}

export function SpecialPricingManager({ outletId }: { outletId: string }) {
  const [prices, setPrices] = useState<SpecialPrice[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ group_id: '', product_id: '', price: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [priceRes, groupRes, productRes] = await Promise.all([
      fetch(`/api/special-prices?outlet_id=${outletId}`),
      fetch(`/api/customer-groups?outlet_id=${outletId}`),
      fetch('/api/products?limit=200'),
    ])
    const priceData = await priceRes.json()
    const groupData = await groupRes.json()
    const productData = await productRes.json()
    if (priceRes.ok) setPrices(priceData.special_prices ?? [])
    if (groupRes.ok) setGroups(groupData.groups ?? [])
    if (productRes.ok) setProducts(productData.data ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/special-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, outlet_id: outletId, price: Number(form.price) }),
      })
      if (res.ok) {
        showToast('Harga khusus tersimpan', 'success')
        setForm({ group_id: '', product_id: '', price: '' })
        setShowForm(false)
        load()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {groups.length === 0 && !isLoading && (
        <Alert variant="info">Buat Customer Group terlebih dahulu sebelum menambahkan harga khusus.</Alert>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)} disabled={groups.length === 0}>
          {showForm ? 'Batal' : '+ Tambah Harga Khusus'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Grup Pelanggan</label>
            <select required value={form.group_id} onChange={(e) => setForm((f) => ({ ...f, group_id: e.target.value }))} className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Pilih grup…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Produk</label>
            <select
              required
              value={form.product_id}
              onChange={(e) => {
                const product = products.find((p) => p.id === e.target.value)
                setForm((f) => ({ ...f, product_id: e.target.value, price: product ? String(product.selling_price) : f.price }))
              }}
              className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Pilih produk…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <Input label="Harga Khusus (Rp)" type="number" min="0" required value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
          <div className="sm:col-span-3">
            <Button type="submit" isLoading={isSubmitting}>
              Simpan
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Grup</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Harga Khusus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : prices.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400">Belum ada harga khusus</td>
              </tr>
            ) : (
              prices.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{p.customer_groups?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-700">{p.products?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(p.price)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
