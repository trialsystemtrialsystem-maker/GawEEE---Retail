'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { formatDateTime } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Outlet {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
}

interface Transfer {
  id: string
  source_outlet_id: string
  destination_outlet_id: string
  status: string
  notes: string | null
  created_at: string
  shipped_at: string | null
  received_at: string | null
  source: { name: string } | null
  destination: { name: string } | null
}

type Line = { product_id: string; quantity: string }
type View = 'request' | 'must-sent' | 'transfer' | 'in-transit' | 'receive'

const VIEW_CONFIG: Record<View, { statusFilter?: string; roleFilter?: 'source' | 'destination'; showCreate: boolean; action?: 'ship' | 'receive'; emptyLabel: string }> = {
  request: { showCreate: true, emptyLabel: 'Belum ada permintaan mutasi stok' },
  'must-sent': { statusFilter: 'requested', roleFilter: 'source', showCreate: false, action: 'ship', emptyLabel: 'Tidak ada mutasi yang harus dikirim dari outlet ini' },
  transfer: { statusFilter: 'requested', roleFilter: 'source', showCreate: false, action: 'ship', emptyLabel: 'Tidak ada mutasi yang menunggu dikirim' },
  'in-transit': { statusFilter: 'in_transit', showCreate: false, emptyLabel: 'Tidak ada mutasi dalam perjalanan' },
  receive: { statusFilter: 'in_transit', roleFilter: 'destination', showCreate: false, action: 'receive', emptyLabel: 'Tidak ada mutasi yang menunggu diterima' },
}

export function StockTransferManager({ outletId, view, canManage }: { outletId: string; view: View; canManage: boolean }) {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ source_outlet_id: outletId, destination_outlet_id: '', notes: '' })
  const [lines, setLines] = useState<Line[]>([{ product_id: '', quantity: '1' }])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)
  const config = VIEW_CONFIG[view]

  const load = useCallback(async () => {
    setIsLoading(true)
    const params = new URLSearchParams({ outlet_id: outletId })
    if (config.statusFilter) params.set('status', config.statusFilter)
    const [transferRes, outletRes, productRes] = await Promise.all([
      fetch(`/api/stock-transfers?${params.toString()}`),
      fetch('/api/company-outlets'),
      fetch('/api/products?limit=200'),
    ])
    const transferData = await transferRes.json()
    const outletData = await outletRes.json()
    const productData = await productRes.json()
    if (transferRes.ok) setTransfers(transferData.transfers ?? [])
    if (outletRes.ok) setOutlets(outletData.outlets ?? [])
    if (productRes.ok) setProducts(productData.data ?? [])
    setIsLoading(false)
  }, [outletId, config.statusFilter])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  const visibleTransfers = transfers.filter((t) => {
    if (config.roleFilter === 'source') return t.source_outlet_id === outletId
    if (config.roleFilter === 'destination') return t.destination_outlet_id === outletId
    return true
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/stock-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          items: lines.filter((l) => l.product_id && Number(l.quantity) > 0).map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity) })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal membuat permintaan mutasi')
        return
      }
      showToast('Permintaan mutasi stok dibuat', 'success')
      setForm({ source_outlet_id: outletId, destination_outlet_id: '', notes: '' })
      setLines([{ product_id: '', quantity: '1' }])
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAction(id: string) {
    if (!config.action) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/stock-transfers/${id}/${config.action}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal memproses mutasi', 'danger')
        return
      }
      showToast(config.action === 'ship' ? 'Stok dikirim' : 'Stok diterima', 'success')
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {config.showCreate && canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Batal' : '+ Buat Permintaan Mutasi'}
          </Button>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {config.showCreate && showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Dari Outlet</label>
              <select
                required
                value={form.source_outlet_id}
                onChange={(e) => setForm((f) => ({ ...f, source_outlet_id: e.target.value }))}
                className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Ke Outlet</label>
              <select
                required
                value={form.destination_outlet_id}
                onChange={(e) => setForm((f) => ({ ...f, destination_outlet_id: e.target.value }))}
                className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Pilih outlet tujuan…</option>
                {outlets.filter((o) => o.id !== form.source_outlet_id).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {outlets.length < 2 && (
            <Alert variant="info">Mutasi stok butuh minimal 2 outlet. Tambahkan outlet lain lewat Master Admin.</Alert>
          )}

          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_auto]">
                <select
                  required
                  value={line.product_id}
                  onChange={(e) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, product_id: e.target.value } : l)))}
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
                  onChange={(e) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, quantity: e.target.value } : l)))}
                  className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {lines.length > 1 && (
                  <button type="button" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))} className="text-sm text-red-500 hover:text-red-700">
                    Hapus
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setLines((prev) => [...prev, { product_id: '', quantity: '1' }])} className="text-sm font-medium text-blue-600 hover:text-blue-700">
              + Tambah item
            </button>
          </div>

          <Button type="submit" isLoading={isSubmitting} disabled={outlets.length < 2}>
            Kirim Permintaan
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Dari</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Ke</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Dibuat</th>
              {config.action && <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : visibleTransfers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">{config.emptyLabel}</td>
              </tr>
            ) : (
              visibleTransfers.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{t.source?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-900">{t.destination?.name ?? '-'}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{t.status}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{formatDateTime(t.created_at)}</td>
                  {config.action && (
                    <td className="px-4 py-2">
                      {canManage && (
                        <button onClick={() => handleAction(t.id)} disabled={busyId === t.id} className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50">
                          {config.action === 'ship' ? 'Kirim Stok' : 'Terima Stok'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
