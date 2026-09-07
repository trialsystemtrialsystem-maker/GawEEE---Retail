'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Product {
  id: string
  name: string
  selling_price: number
}
interface Deposit {
  id: string
  customer_name: string
  customer_phone: string | null
  product_id: string
  quantity: number
  deposit_amount: number
  total_price: number
  status: 'pending' | 'fulfilled' | 'cancelled'
  created_at: string
  products: { name: string } | null
}

const STATUS_LABELS: Record<Deposit['status'], string> = { pending: 'Menunggu', fulfilled: 'Selesai', cancelled: 'Dibatalkan' }
const STATUS_STYLES: Record<Deposit['status'], string> = {
  pending: 'bg-amber-50 text-amber-700',
  fulfilled: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

// A tracking log, not deep checkout integration — fulfilling here is a
// manual status change; the actual sale still goes through the normal POS
// separately, same scoping as Bookings. See Phase 13 Batch D item 10.
export function ProductDepositManager({ outletId }: { outletId: string }) {
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [depositAmount, setDepositAmount] = useState('')
  const [totalPrice, setTotalPrice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [depositRes, productRes] = await Promise.all([fetch(`/api/product-deposits?outlet_id=${outletId}`), fetch('/api/products?limit=200')])
    const depositData = await depositRes.json()
    const productData = await productRes.json()
    if (depositRes.ok) setDeposits(depositData.deposits ?? [])
    if (productRes.ok) setProducts(productData.data ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  function handleProductChange(id: string) {
    setProductId(id)
    const product = products.find((p) => p.id === id)
    if (product) setTotalPrice(String(product.selling_price * Number(quantity || 1)))
  }

  function handleQuantityChange(qty: string) {
    setQuantity(qty)
    const product = products.find((p) => p.id === productId)
    if (product) setTotalPrice(String(product.selling_price * Number(qty || 1)))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/product-deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          customer_name: customerName,
          customer_phone: customerPhone || undefined,
          product_id: productId,
          quantity: Number(quantity),
          deposit_amount: Number(depositAmount),
          total_price: Number(totalPrice),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal mencatat deposit', 'danger')
        return
      }
      setCustomerName('')
      setCustomerPhone('')
      setProductId('')
      setQuantity('1')
      setDepositAmount('')
      setTotalPrice('')
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleStatusChange(deposit: Deposit, status: Deposit['status']) {
    setBusyId(deposit.id)
    try {
      await fetch(`/api/product-deposits/${deposit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Catat Deposit'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-2">
          <Input label="Nama Pelanggan" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <Input label="Telepon (opsional)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Produk</label>
            <select
              required
              value={productId}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Pilih produk…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatCurrency(p.selling_price)})
                </option>
              ))}
            </select>
          </div>
          <Input label="Jumlah" type="number" min={1} required value={quantity} onChange={(e) => handleQuantityChange(e.target.value)} />
          <Input label="Uang Muka / Deposit (Rp)" type="number" min="0" required value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
          <Input label="Total Harga (Rp)" type="number" min="0" required value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} />
          <div className="sm:col-span-2">
            <Button type="submit" isLoading={isSubmitting}>
              Simpan Deposit
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Pelanggan</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Jumlah</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Deposit</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Total</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : deposits.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Belum ada deposit tercatat</td></tr>
            ) : (
              deposits.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">
                    {d.customer_name}
                    {d.customer_phone && <span className="block text-xs text-gray-400">{d.customer_phone}</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{d.products?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{d.quantity}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(d.deposit_amount)}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(d.total_price)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[d.status]}`}>{STATUS_LABELS[d.status]}</span>
                    <p className="mt-0.5 text-[11px] text-gray-400">{formatDateTime(d.created_at)}</p>
                  </td>
                  <td className="px-4 py-2">
                    {d.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === d.id}
                          onClick={() => handleStatusChange(d, 'fulfilled')}
                          className="text-xs font-medium text-emerald-600 hover:underline disabled:opacity-50"
                        >
                          Selesaikan
                        </button>
                        <button
                          type="button"
                          disabled={busyId === d.id}
                          onClick={() => handleStatusChange(d, 'cancelled')}
                          className="text-xs text-red-500 hover:underline disabled:opacity-50"
                        >
                          Batalkan
                        </button>
                      </div>
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
