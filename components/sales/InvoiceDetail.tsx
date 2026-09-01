'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Invoice {
  id: string
  outlet_id: string
  invoice_number: string
  customer_name: string | null
  subtotal: number
  discount_amount: number
  tax_amount: number
  total: number
  payment_status: string
  order_status: string
  created_at: string
  void_reason: string | null
}
interface InvoiceItem {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
  products: { name: string } | null
}
interface Payment {
  id: string
  payment_method: string
  status: string
  amount: number
}
interface Refund {
  id: string
  status: 'draft' | 'completed'
  total_amount: number
  refund_method: string
  reason: string
  created_at: string
  customer_refund_items: { product_id: string; quantity: number; unit_price: number }[]
}

export function InvoiceDetail({ invoiceId, canVoid }: { invoiceId: string; canVoid: boolean }) {
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isVoiding, setIsVoiding] = useState(false)
  const [showRefundForm, setShowRefundForm] = useState(false)
  const [refundQty, setRefundQty] = useState<Record<string, number>>({})
  const [refundMethod, setRefundMethod] = useState<'cash' | 'e_wallet' | 'bank_transfer'>('cash')
  const [refundReason, setRefundReason] = useState('')
  const [isRefunding, setIsRefunding] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    const res = await fetch(`/api/invoices/${invoiceId}`)
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Gagal memuat invoice')
      return
    }
    setInvoice(data.invoice)
    setItems(data.items ?? [])
    setPayments(data.payments ?? [])
    setRefunds(data.refunds ?? [])
  }, [invoiceId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleVoid() {
    const reason = window.prompt('Alasan pembatalan transaksi:')
    if (!reason || !reason.trim()) return
    setIsVoiding(true)
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal membatalkan invoice')
        return
      }
      showToast('Transaksi berhasil dibatalkan, stok dikembalikan', 'success')
      router.refresh()
      load()
    } finally {
      setIsVoiding(false)
    }
  }

  async function handleRefundSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!invoice) return
    const lines = Object.entries(refundQty)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const item = items.find((it) => it.product_id === productId)!
        return { product_id: productId, quantity: qty, unit_price: item.unit_price }
      })
    if (lines.length === 0) {
      setError('Pilih minimal 1 item untuk diretur')
      return
    }
    if (!refundReason.trim()) {
      setError('Alasan refund wajib diisi')
      return
    }
    setError(null)
    setIsRefunding(true)
    try {
      const createRes = await fetch('/api/customer-refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: invoice.outlet_id,
          invoice_id: invoiceId,
          refund_method: refundMethod,
          reason: refundReason,
          items: lines,
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) {
        setError(typeof createData.error === 'string' ? createData.error : 'Gagal membuat refund')
        return
      }
      const submitRes = await fetch(`/api/customer-refunds/${createData.refund.id}/submit`, { method: 'POST' })
      const submitData = await submitRes.json()
      if (!submitRes.ok) {
        setError(typeof submitData.error === 'string' ? submitData.error : 'Gagal memproses refund')
        return
      }
      showToast('Refund berhasil diproses, stok dikembalikan', 'success')
      setRefundQty({})
      setRefundReason('')
      setShowRefundForm(false)
      load()
    } finally {
      setIsRefunding(false)
    }
  }

  if (error) return <Alert variant="danger">{error}</Alert>
  if (!invoice) return <p className="text-gray-400">Memuat…</p>

  const refundedQtyByProduct = refunds.reduce<Record<string, number>>((acc, r) => {
    for (const it of r.customer_refund_items) {
      acc[it.product_id] = (acc[it.product_id] ?? 0) + it.quantity
    }
    return acc
  }, {})
  const canRefund = canVoid && invoice.order_status !== 'voided' && invoice.payment_status === 'paid'

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{invoice.invoice_number}</h1>
            <p className="text-sm text-gray-500">{formatDateTime(invoice.created_at)}</p>
          </div>
          {invoice.order_status === 'voided' ? (
            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-600">Dibatalkan</span>
          ) : (
            canVoid && (
              <Button variant="danger" size="sm" isLoading={isVoiding} onClick={handleVoid}>
                Batalkan Transaksi
              </Button>
            )
          )}
        </div>

        {invoice.order_status === 'voided' && invoice.void_reason && (
          <Alert variant="warning">Alasan pembatalan: {invoice.void_reason}</Alert>
        )}

        {invoice.customer_name && <p className="text-sm text-gray-600">Pelanggan: {invoice.customer_name}</p>}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Item</h2>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="py-1.5">{item.quantity}x</td>
                <td className="py-1.5">{item.products?.name ?? item.product_id}</td>
                <td className="py-1.5">{formatCurrency(item.unit_price)}</td>
                <td className="py-1.5 text-right">{formatCurrency(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Diskon</span>
            <span>{formatCurrency(invoice.discount_amount)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>PPN</span>
            <span>{formatCurrency(invoice.tax_amount)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-1 font-bold text-gray-900">
            <span>Total</span>
            <span>{formatCurrency(invoice.total)}</span>
          </div>
        </div>
      </Card>

      {payments.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Pembayaran</h2>
          <ul className="divide-y divide-gray-100 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between py-1.5">
                <span className="capitalize text-gray-600">{p.payment_method.replace('_', ' ')}</span>
                <span className="text-gray-900">
                  {formatCurrency(p.amount)} · {p.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(canRefund || refunds.length > 0) && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Retur / Refund Pelanggan</h2>
            {canRefund && (
              <Button size="sm" variant="secondary" onClick={() => setShowRefundForm((v) => !v)}>
                {showRefundForm ? 'Batal' : '+ Buat Refund'}
              </Button>
            )}
          </div>

          {showRefundForm && (
            <form onSubmit={handleRefundSubmit} className="space-y-3 rounded-md border border-gray-200 p-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="pb-1 font-medium">Produk</th>
                    <th className="pb-1 font-medium">Dibeli</th>
                    <th className="pb-1 font-medium">Sudah Diretur</th>
                    <th className="pb-1 font-medium">Jumlah Retur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => {
                    const alreadyRefunded = refundedQtyByProduct[item.product_id] ?? 0
                    const maxRefundable = item.quantity - alreadyRefunded
                    return (
                      <tr key={item.id}>
                        <td className="py-1.5">{item.products?.name ?? item.product_id}</td>
                        <td className="py-1.5">{item.quantity}</td>
                        <td className="py-1.5">{alreadyRefunded}</td>
                        <td className="py-1.5">
                          <input
                            type="number"
                            min={0}
                            max={maxRefundable}
                            disabled={maxRefundable <= 0}
                            value={refundQty[item.product_id] ?? 0}
                            onChange={(e) =>
                              setRefundQty((q) => ({
                                ...q,
                                [item.product_id]: Math.max(0, Math.min(maxRefundable, Number(e.target.value))),
                              }))
                            }
                            className="w-20 rounded-sm border border-gray-200 px-2 py-1 text-sm disabled:bg-gray-50"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Metode Refund</label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value as typeof refundMethod)}
                    className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="cash">Tunai</option>
                    <option value="e_wallet">E-Wallet</option>
                    <option value="bank_transfer">Transfer Bank</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Alasan</label>
                  <input
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="mis. Produk rusak"
                    className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <Button type="submit" isLoading={isRefunding}>
                Proses Refund
              </Button>
            </form>
          )}

          {refunds.length > 0 && (
            <ul className="divide-y divide-gray-100 text-sm">
              {refunds.map((r) => (
                <li key={r.id} className="py-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      {formatDateTime(r.created_at)} · {r.refund_method.replace('_', ' ')}
                    </span>
                    <span className="font-medium text-gray-900">{formatCurrency(r.total_amount)}</span>
                  </div>
                  <p className="text-xs text-gray-500">{r.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
