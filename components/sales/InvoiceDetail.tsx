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
}
interface Payment {
  id: string
  payment_method: string
  status: string
  amount: number
}

export function InvoiceDetail({ invoiceId, canVoid }: { invoiceId: string; canVoid: boolean }) {
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isVoiding, setIsVoiding] = useState(false)
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

  if (error) return <Alert variant="danger">{error}</Alert>
  if (!invoice) return <p className="text-gray-400">Memuat…</p>

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
    </div>
  )
}
