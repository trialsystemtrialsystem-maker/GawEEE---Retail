'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Product {
  id: string
  sku: string
  name: string
  barcode: string | null
  purchase_price: number
  selling_price: number
  unit_type: string
  reorder_level: number
  is_active: boolean
}

const emptyForm = {
  sku: '',
  name: '',
  barcode: '',
  purchase_price: '',
  selling_price: '',
  unit_type: 'pcs',
  reorder_level: '10',
  reorder_quantity: '50',
}

export function ProductList() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/products?limit=200')
    const data = await res.json()
    if (res.ok) setProducts(data.data ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          purchase_price: Number(form.purchase_price),
          selling_price: Number(form.selling_price),
          reorder_level: Number(form.reorder_level),
          reorder_quantity: Number(form.reorder_quantity),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menambah produk')
        return
      }
      showToast(`Produk "${form.name}" berhasil ditambahkan`, 'success')
      setForm(emptyForm)
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Produk</h2>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Tambah Produk'}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="SKU" required value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
          <Input label="Nama Produk" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Barcode" value={form.barcode} onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))} />
          <Input
            label="Harga Beli"
            type="number"
            required
            value={form.purchase_price}
            onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))}
          />
          <Input
            label="Harga Jual"
            type="number"
            required
            value={form.selling_price}
            onChange={(e) => setForm((f) => ({ ...f, selling_price: e.target.value }))}
          />
          <Input label="Satuan" value={form.unit_type} onChange={(e) => setForm((f) => ({ ...f, unit_type: e.target.value }))} />
          <Input
            label="Reorder Level"
            type="number"
            value={form.reorder_level}
            onChange={(e) => setForm((f) => ({ ...f, reorder_level: e.target.value }))}
          />
          <Input
            label="Reorder Quantity"
            type="number"
            value={form.reorder_quantity}
            onChange={(e) => setForm((f) => ({ ...f, reorder_quantity: e.target.value }))}
          />
          <div className="flex items-end lg:col-span-3">
            <Button type="submit" isLoading={isSubmitting}>
              Simpan Produk
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Nama</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">SKU</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Harga Beli</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Harga Jual</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada produk</td></tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{p.name}</td>
                  <td className="px-4 py-2 text-gray-500">{p.sku}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(p.purchase_price)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(p.selling_price)}</td>
                  <td className={`px-4 py-2 ${p.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {p.is_active ? 'Aktif' : 'Nonaktif'}
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
