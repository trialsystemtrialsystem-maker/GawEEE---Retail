'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Product {
  id: string
  name: string
  selling_price: number
}
interface OrderItem {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
  products: { name: string } | null
}
interface Order {
  id: string
  customer_name: string
  customer_phone: string | null
  order_number: string
  order_date: string
  status: 'draft' | 'confirmed' | 'fulfilled' | 'cancelled'
  invoice_id: string | null
  sales_order_items: OrderItem[]
}
interface QuotationOption {
  id: string
  customer_name: string
  customer_phone: string | null
  quotation_number: string
  sales_quotation_items: { product_id: string; quantity: number; unit_price: number }[]
}
interface DraftLine {
  product_id: string
  quantity: number
  unit_price: string
}

const STATUS_LABEL: Record<Order['status'], string> = { draft: 'Draft', confirmed: 'Dikonfirmasi', fulfilled: 'Terpenuhi', cancelled: 'Dibatalkan' }
const STATUS_STYLE: Record<Order['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  confirmed: 'bg-brand-50 text-brand-700',
  fulfilled: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
}

export function OrderManager({ outletId }: { outletId: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [quotations, setQuotations] = useState<QuotationOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [fromQuotationId, setFromQuotationId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([{ product_id: '', quantity: 1, unit_price: '' }])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [orderRes, productRes, quotationRes] = await Promise.all([
      fetch(`/api/sales-orders?outlet_id=${outletId}`),
      fetch('/api/products?limit=200'),
      fetch(`/api/sales-quotations?outlet_id=${outletId}`),
    ])
    const orderData = await orderRes.json()
    const productData = await productRes.json()
    const quotationData = await quotationRes.json()
    if (orderRes.ok) setOrders(orderData.orders ?? [])
    if (productRes.ok) setProducts(productData.data ?? [])
    if (quotationRes.ok) {
      const accepted = (quotationData.quotations ?? []).filter((q: { status: string; invoice_id: string | null }) => q.status === 'accepted' && !q.invoice_id)
      setQuotations(accepted)
    }
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  function applyQuotation(quotationId: string) {
    setFromQuotationId(quotationId)
    const quotation = quotations.find((q) => q.id === quotationId)
    if (!quotation) return
    setCustomerName(quotation.customer_name)
    setCustomerPhone(quotation.customer_phone ?? '')
    setLines(quotation.sales_quotation_items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_price: String(i.unit_price) })))
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((ls) =>
      ls.map((l, i) => {
        if (i !== index) return l
        const next = { ...l, ...patch }
        if (patch.product_id) {
          const product = products.find((p) => p.id === patch.product_id)
          if (product && !l.unit_price) next.unit_price = String(product.selling_price)
        }
        return next
      })
    )
  }
  function addLine() {
    setLines((ls) => [...ls, { product_id: '', quantity: 1, unit_price: '' }])
  }
  function removeLine(index: number) {
    setLines((ls) => ls.filter((_, i) => i !== index))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const validLines = lines.filter((l) => l.product_id && l.quantity > 0 && l.unit_price)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          customer_name: customerName,
          customer_phone: customerPhone || undefined,
          quotation_id: fromQuotationId || undefined,
          items: validLines.map((l) => ({ product_id: l.product_id, quantity: l.quantity, unit_price: Number(l.unit_price) })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal membuat order', 'danger')
        return
      }
      setFromQuotationId('')
      setCustomerName('')
      setCustomerPhone('')
      setLines([{ product_id: '', quantity: 1, unit_price: '' }])
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleStatusChange(order: Order, status: string) {
    setBusyId(order.id)
    try {
      await fetch(`/api/sales-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      load()
    } finally {
      setBusyId(null)
    }
  }

  async function handleFulfill(order: Order) {
    setBusyId(order.id)
    try {
      const res = await fetch(`/api/sales-orders/${order.id}/fulfill`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal memenuhi order', 'danger')
        return
      }
      showToast(`Invoice ${data.invoice_number} dibuat`, 'success')
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Buat Order'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-gray-200 p-4">
          {quotations.length > 0 && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Dari Quotation (opsional)</label>
              <select
                value={fromQuotationId}
                onChange={(e) => applyQuotation(e.target.value)}
                className="w-full max-w-sm rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Buat order baru</option>
                {quotations.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quotation_number} — {q.customer_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input name="customer_name" label="Nama Pelanggan" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <Input name="customer_phone" label="Telepon (opsional)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Item Order</label>
            {lines.map((line, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <select
                  value={line.product_id}
                  onChange={(e) => updateLine(i, { product_id: e.target.value })}
                  className="min-w-[180px] flex-1 rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Pilih produk…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatCurrency(p.selling_price)})
                    </option>
                  ))}
                </select>
                <Input type="number" min={1} className="w-20" value={line.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
                <Input type="number" min="0" placeholder="Harga" className="w-32" value={line.unit_price} onChange={(e) => updateLine(i, { unit_price: e.target.value })} />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(i)}>
                  Hapus
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={addLine}>
              + Tambah Item
            </Button>
          </div>

          <Button type="submit" isLoading={isSubmitting}>
            Simpan Order
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">No. Order</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Pelanggan</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Item</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Total</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Belum ada order</td></tr>
            ) : (
              orders.map((o) => {
                const total = o.sales_order_items.reduce((s, i) => s + i.subtotal, 0)
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {o.order_number}
                      <p className="text-xs font-normal text-gray-400">{formatDate(o.order_date)}</p>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{o.customer_name}</td>
                    <td className="px-4 py-2 text-gray-600">{o.sales_order_items.map((i) => `${i.products?.name ?? '?'} x${i.quantity}`).join(', ')}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(total)}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        {o.status === 'draft' && (
                          <button disabled={busyId === o.id} onClick={() => handleStatusChange(o, 'confirmed')} className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50">
                            Konfirmasi
                          </button>
                        )}
                        {o.status === 'confirmed' && (
                          <button disabled={busyId === o.id} onClick={() => handleFulfill(o)} className="text-xs font-medium text-[var(--brand-600)] hover:underline disabled:opacity-50">
                            Fulfill (buat invoice)
                          </button>
                        )}
                        {(o.status === 'draft' || o.status === 'confirmed') && (
                          <button disabled={busyId === o.id} onClick={() => handleStatusChange(o, 'cancelled')} className="text-xs text-red-500 hover:underline disabled:opacity-50">
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

      {!isLoading && orders.length === 0 && <Alert variant="info">Buat order di atas untuk memulai.</Alert>}
    </div>
  )
}
