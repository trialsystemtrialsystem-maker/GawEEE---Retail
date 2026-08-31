'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Product {
  product_id: string
  name: string
  quantity_on_hand: number
}

interface WasteEntry {
  id: string
  quantity_change: number
  unit_cost: number | null
  notes: string | null
  created_at: string
  products: { name: string } | null
}

export function StockWasteManager({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [products, setProducts] = useState<Product[]>([])
  const [entries, setEntries] = useState<WasteEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ product_id: '', quantity: '1', reason: '' })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [prodRes, entriesRes] = await Promise.all([
      fetch(`/api/inventory/${outletId}`),
      fetch(`/api/inventory/waste?outlet_id=${outletId}`),
    ])
    const prodData = await prodRes.json()
    const entriesData = await entriesRes.json()
    if (prodRes.ok) setProducts(prodData.inventory ?? [])
    if (entriesRes.ok) setEntries(entriesData.entries ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/inventory/waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, outlet_id: outletId, quantity: Number(form.quantity) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal mencatat stock waste')
        return
      }
      showToast('Stock waste tercatat, stok telah dikurangi', 'success')
      setForm({ product_id: '', quantity: '1', reason: '' })
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Batal' : '+ Catat Stock Waste'}
          </Button>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Produk</label>
            <select
              required
              value={form.product_id}
              onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}
              className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-1/2"
            >
              <option value="">Pilih produk…</option>
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.name} (stok: {p.quantity_on_hand})
                </option>
              ))}
            </select>
          </div>
          <Input label="Jumlah" type="number" min="1" required value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
          <div className="sm:col-span-2">
            <Input label="Alasan" required placeholder="Kadaluarsa, rusak saat pengiriman, dll" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          </div>
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
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Waktu</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Jumlah</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Nilai Kerugian</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Alasan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada catatan stock waste</td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600">{formatDateTime(e.created_at)}</td>
                  <td className="px-4 py-2 text-gray-900">{e.products?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-right text-red-600">{e.quantity_change}</td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {formatCurrency(Math.abs(e.quantity_change) * (e.unit_cost ?? 0))}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{e.notes ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
