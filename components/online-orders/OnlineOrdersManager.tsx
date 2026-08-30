'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface OrderItem {
  name: string
  quantity: number
  price: number
}

interface OnlineOrder {
  id: string
  order_number: string
  channel: string
  customer_name: string
  customer_phone: string | null
  items: OrderItem[]
  total_amount: number
  status: string
  created_at: string
}

const STATUS_TABS = [
  { key: 'incoming', label: 'Incoming Order' },
  { key: 'on_process', label: 'On Process' },
  { key: 'on_delivery', label: 'On Delivery' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancel/Refund' },
] as const

const NEXT_STATUS: Record<string, { key: string; label: string } | null> = {
  incoming: { key: 'on_process', label: 'Proses Pesanan' },
  on_process: { key: 'on_delivery', label: 'Kirim Pesanan' },
  on_delivery: { key: 'completed', label: 'Tandai Selesai' },
  completed: null,
  cancelled: null,
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  marketplace: 'Marketplace',
  other: 'Lainnya',
}

type ItemForm = { name: string; quantity: string; price: string }

export function OnlineOrdersManager({ outletId }: { outletId: string }) {
  const [orders, setOrders] = useState<OnlineOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]['key']>('incoming')
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({ channel: 'whatsapp', customer_name: '', customer_phone: '' })
  const [items, setItems] = useState<ItemForm[]>([{ name: '', quantity: '1', price: '' }])
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/online-orders?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setOrders(data.orders ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  const counts = STATUS_TABS.reduce<Record<string, number>>((acc, t) => {
    acc[t.key] = orders.filter((o) => o.status === t.key).length
    return acc
  }, {})

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/online-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          outlet_id: outletId,
          items: items
            .filter((i) => i.name && Number(i.quantity) > 0)
            .map((i) => ({ name: i.name, quantity: Number(i.quantity), price: Number(i.price) || 0 })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menambah pesanan')
        return
      }
      showToast(`Pesanan ${data.order.order_number} berhasil dicatat`, 'success')
      setForm({ channel: 'whatsapp', customer_name: '', customer_phone: '' })
      setItems([{ name: '', quantity: '1', price: '' }])
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function advanceStatus(order: OnlineOrder, nextStatus: string) {
    const res = await fetch(`/api/online-orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    const data = await res.json()
    if (!res.ok) {
      showToast(typeof data.error === 'string' ? data.error : 'Gagal mengubah status', 'danger')
      return
    }
    load()
  }

  const visibleOrders = orders.filter((o) => o.status === tab)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS_TABS.filter((t) => t.key !== 'cancelled').map((t) => (
          <Card key={t.key} className="text-center">
            <p className="text-sm text-gray-500">{t.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{counts[t.key] ?? 0}</p>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1 border-b border-gray-200">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm font-medium ${
                tab === t.key ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label} ({counts[t.key] ?? 0})
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Catat Pesanan'}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Channel</label>
              <select
                value={form.channel}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(CHANNEL_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Nama Pelanggan"
              required
              value={form.customer_name}
              onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
            />
            <Input
              label="No. Telepon"
              value={form.customer_phone}
              onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Item Pesanan</label>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_100px_140px_auto]">
                <input
                  placeholder="Nama barang"
                  value={item.name}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, name: e.target.value } : it)))
                  }
                  className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, quantity: e.target.value } : it)))
                  }
                  className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Harga satuan"
                  value={item.price}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, price: e.target.value } : it)))
                  }
                  className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Hapus
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, { name: '', quantity: '1', price: '' }])}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              + Tambah item
            </button>
          </div>

          <Button type="submit" isLoading={isSubmitting}>
            Simpan Pesanan
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">No. Order</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Channel</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Pelanggan</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Total</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Waktu</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : visibleOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">Tidak ada pesanan</td>
              </tr>
            ) : (
              visibleOrders.map((o) => {
                const next = NEXT_STATUS[o.status]
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">{o.order_number}</td>
                    <td className="px-4 py-2 text-gray-600">{CHANNEL_LABEL[o.channel] ?? o.channel}</td>
                    <td className="px-4 py-2 text-gray-900">{o.customer_name}</td>
                    <td className="px-4 py-2 text-gray-900">{formatCurrency(o.total_amount)}</td>
                    <td className="px-4 py-2 text-gray-500">{formatDateTime(o.created_at)}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        {next && (
                          <button
                            onClick={() => advanceStatus(o, next.key)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700"
                          >
                            {next.label}
                          </button>
                        )}
                        {o.status !== 'completed' && o.status !== 'cancelled' && (
                          <button
                            onClick={() => advanceStatus(o, 'cancelled')}
                            className="text-sm font-medium text-red-500 hover:text-red-700"
                          >
                            Batalkan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
