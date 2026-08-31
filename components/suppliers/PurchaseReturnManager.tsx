'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Supplier {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  purchase_price: number
}

interface PurchaseReturnRow {
  id: string
  return_date: string
  reason: string
  status: string
  total_amount: number
  suppliers: { name: string } | null
}

type Line = { product_id: string; quantity: string; unit_cost: string }

export function PurchaseReturnManager({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [returns, setReturns] = useState<PurchaseReturnRow[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ supplier_id: '', return_date: new Date().toISOString().slice(0, 10), reason: '' })
  const [lines, setLines] = useState<Line[]>([{ product_id: '', quantity: '1', unit_cost: '' }])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [retRes, supRes, prodRes] = await Promise.all([
      fetch(`/api/purchase-returns?outlet_id=${outletId}`),
      fetch('/api/suppliers'),
      fetch('/api/products?limit=200'),
    ])
    const retData = await retRes.json()
    const supData = await supRes.json()
    const prodData = await prodRes.json()
    if (retRes.ok) setReturns(retData.returns ?? [])
    if (supRes.ok) setSuppliers(supData.suppliers ?? [])
    if (prodRes.ok) setProducts(prodData.data ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/purchase-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          outlet_id: outletId,
          items: lines
            .filter((l) => l.product_id && Number(l.quantity) > 0)
            .map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity), unit_cost: Number(l.unit_cost) || 0 })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal membuat retur')
        return
      }
      showToast('Retur pembelian (draft) berhasil dibuat', 'success')
      setForm({ supplier_id: '', return_date: new Date().toISOString().slice(0, 10), reason: '' })
      setLines([{ product_id: '', quantity: '1', unit_cost: '' }])
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submitReturn(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/purchase-returns/${id}/submit`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal menyelesaikan retur', 'danger')
        return
      }
      showToast('Retur selesai, stok telah dikurangi', 'success')
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Batal' : '+ Buat Retur'}
          </Button>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Supplier</label>
              <select
                required
                value={form.supplier_id}
                onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
                className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Pilih supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <Input label="Tanggal Retur" type="date" required value={form.return_date} onChange={(e) => setForm((f) => ({ ...f, return_date: e.target.value }))} />
            <Input label="Alasan" required value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          </div>

          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_100px_140px_auto]">
                <select
                  required
                  value={line.product_id}
                  onChange={(e) => {
                    const product = products.find((p) => p.id === e.target.value)
                    updateLine(i, { product_id: e.target.value, unit_cost: product ? String(product.purchase_price) : line.unit_cost })
                  }}
                  className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Pilih produk…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) => updateLine(i, { quantity: e.target.value })}
                  className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Harga beli"
                  value={line.unit_cost}
                  onChange={(e) => updateLine(i, { unit_cost: e.target.value })}
                  className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {lines.length > 1 && (
                  <button type="button" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))} className="text-sm text-red-500 hover:text-red-700">
                    Hapus
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, { product_id: '', quantity: '1', unit_cost: '' }])}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              + Tambah item
            </button>
          </div>

          <Button type="submit" isLoading={isSubmitting}>
            Simpan Draft
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Supplier</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Alasan</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Nilai</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : returns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">Belum ada retur pembelian</td>
              </tr>
            ) : (
              returns.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">{formatDate(r.return_date)}</td>
                  <td className="px-4 py-2 text-gray-900">{r.suppliers?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-600">{r.reason}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(r.total_amount)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {r.status === 'completed' ? 'Selesai' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {r.status === 'draft' && canManage && (
                      <button onClick={() => submitReturn(r.id)} disabled={busyId === r.id} className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50">
                        Selesaikan
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
