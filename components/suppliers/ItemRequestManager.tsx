'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Product {
  product_id: string
  name: string
}

interface ItemRequest {
  id: string
  quantity_requested: number
  reason: string | null
  status: string
  created_at: string
  products: { name: string } | null
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-blue-50 text-blue-700',
  rejected: 'bg-red-50 text-red-700',
  converted: 'bg-emerald-50 text-emerald-700',
}

export function ItemRequestManager({ outletId, canDecide }: { outletId: string; canDecide: boolean }) {
  const [requests, setRequests] = useState<ItemRequest[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ product_id: '', quantity_requested: '1', reason: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [reqRes, prodRes] = await Promise.all([
      fetch(`/api/item-requests?outlet_id=${outletId}`),
      fetch(`/api/inventory/${outletId}`),
    ])
    const reqData = await reqRes.json()
    const prodData = await prodRes.json()
    if (reqRes.ok) setRequests(reqData.requests ?? [])
    if (prodRes.ok) setProducts(prodData.inventory ?? [])
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
      const res = await fetch('/api/item-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, outlet_id: outletId, quantity_requested: Number(form.quantity_requested) }),
      })
      if (res.ok) {
        showToast('Permintaan barang berhasil dikirim', 'success')
        setForm({ product_id: '', quantity_requested: '1', reason: '' })
        setShowForm(false)
        load()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function decide(id: string, decision: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/item-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      if (res.ok) load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Ajukan Permintaan'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Produk</label>
            <select
              required
              value={form.product_id}
              onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}
              className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Pilih produk…</option>
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <Input label="Jumlah" type="number" min="1" required value={form.quantity_requested} onChange={(e) => setForm((f) => ({ ...f, quantity_requested: e.target.value }))} />
          <div className="sm:col-span-3">
            <Input label="Alasan" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" isLoading={isSubmitting}>
              Kirim
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Jumlah</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Alasan</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">Belum ada permintaan barang</td>
              </tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-2 text-gray-900">{r.products?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{r.quantity_requested}</td>
                  <td className="px-4 py-2 text-gray-600">{r.reason ?? '-'}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2">
                    {r.status === 'pending' && canDecide && (
                      <div className="flex gap-3">
                        <button onClick={() => decide(r.id, 'approved')} disabled={busyId === r.id} className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50">
                          Setujui
                        </button>
                        <button onClick={() => decide(r.id, 'rejected')} disabled={busyId === r.id} className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50">
                          Tolak
                        </button>
                      </div>
                    )}
                    {r.status === 'approved' && (
                      <button onClick={() => decide(r.id, 'converted')} disabled={busyId === r.id} className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50">
                        Tandai Sudah Jadi PO
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
