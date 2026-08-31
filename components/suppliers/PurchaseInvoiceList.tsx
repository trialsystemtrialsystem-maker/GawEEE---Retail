'use client'

import { Fragment, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Invoice {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  total: number
  payment_status: string
  purchase_orders: { po_number: string } | null
  suppliers: { name: string } | null
}

interface ReceivedPO {
  id: string
  po_number: string
  suppliers: { name: string } | null
}

interface Payment {
  id: string
  amount: number
  payment_date: string
  payment_method: string
}

const STATUS_COLOR: Record<string, string> = {
  unpaid: 'bg-red-50 text-red-700',
  partial: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700',
}

export function PurchaseInvoiceList({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [receivedPOs, setReceivedPOs] = useState<ReceivedPO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    po_id: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: new Date().toISOString().slice(0, 10),
    subtotal: '',
    tax_amount: '0',
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'cash' })
  const [isPaying, setIsPaying] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [invRes, poRes] = await Promise.all([
      fetch(`/api/purchase-invoices?outlet_id=${outletId}`),
      fetch(`/api/purchase-orders?status=received&outlet_id=${outletId}`),
    ])
    const invData = await invRes.json()
    const poData = await poRes.json()
    if (invRes.ok) setInvoices(invData.invoices ?? [])
    if (poRes.ok) setReceivedPOs(poData.purchase_orders ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/purchase-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, subtotal: Number(form.subtotal), tax_amount: Number(form.tax_amount) || 0 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menyimpan invoice')
        return
      }
      showToast('Invoice supplier berhasil dicatat', 'success')
      setForm({ po_id: '', invoice_number: '', invoice_date: new Date().toISOString().slice(0, 10), due_date: new Date().toISOString().slice(0, 10), subtotal: '', tax_amount: '0' })
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function toggleExpand(invoiceId: string) {
    if (expandedId === invoiceId) {
      setExpandedId(null)
      return
    }
    setExpandedId(invoiceId)
    const res = await fetch(`/api/purchase-invoices/${invoiceId}/payments`)
    const data = await res.json()
    if (res.ok) setPayments(data.payments ?? [])
  }

  async function handlePay(invoiceId: string, e: React.FormEvent) {
    e.preventDefault()
    setIsPaying(true)
    try {
      const res = await fetch(`/api/purchase-invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...paymentForm, amount: Number(paymentForm.amount) }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal mencatat pembayaran', 'danger')
        return
      }
      showToast('Pembayaran tercatat', 'success')
      setPaymentForm({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'cash' })
      load()
      const payRes = await fetch(`/api/purchase-invoices/${invoiceId}/payments`)
      const payData = await payRes.json()
      if (payRes.ok) setPayments(payData.payments ?? [])
    } finally {
      setIsPaying(false)
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm((v) => !v)} disabled={receivedPOs.length === 0}>
            {showForm ? 'Batal' : '+ Catat Invoice'}
          </Button>
        </div>
      )}

      {receivedPOs.length === 0 && !isLoading && (
        <Alert variant="info">Belum ada Purchase Order berstatus &ldquo;received&rdquo; untuk dicatat invoicenya.</Alert>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Purchase Order</label>
            <select
              required
              value={form.po_id}
              onChange={(e) => setForm((f) => ({ ...f, po_id: e.target.value }))}
              className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-1/2"
            >
              <option value="">Pilih PO…</option>
              {receivedPOs.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.po_number} - {po.suppliers?.name}
                </option>
              ))}
            </select>
          </div>
          <Input label="No. Invoice" required value={form.invoice_number} onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))} />
          <Input label="Tanggal Invoice" type="date" required value={form.invoice_date} onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))} />
          <Input label="Jatuh Tempo" type="date" required value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
          <Input label="Subtotal (Rp)" type="number" min="0" required value={form.subtotal} onChange={(e) => setForm((f) => ({ ...f, subtotal: e.target.value }))} />
          <Input label="Pajak (Rp)" type="number" min="0" value={form.tax_amount} onChange={(e) => setForm((f) => ({ ...f, tax_amount: e.target.value }))} />
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
              <th className="px-4 py-2 text-left font-semibold text-gray-600">No. Invoice</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Supplier</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Jatuh Tempo</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Total</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">Belum ada invoice supplier</td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <Fragment key={inv.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">{inv.invoice_number}</td>
                    <td className="px-4 py-2 text-gray-900">{inv.suppliers?.name ?? '-'}</td>
                    <td className="px-4 py-2 text-gray-600">{formatDate(inv.due_date)}</td>
                    <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(inv.total)}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[inv.payment_status]}`}>
                        {inv.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <button onClick={() => toggleExpand(inv.id)} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                        {expandedId === inv.id ? 'Tutup' : 'Detail'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === inv.id && (
                    <tr>
                      <td colSpan={6} className="bg-gray-50 px-4 py-4">
                        <div className="space-y-3">
                          {payments.length > 0 && (
                            <div className="space-y-1 text-sm">
                              {payments.map((p) => (
                                <div key={p.id} className="flex justify-between text-gray-600">
                                  <span>{formatDate(p.payment_date)} · {p.payment_method}</span>
                                  <span>{formatCurrency(p.amount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {canManage && inv.payment_status !== 'paid' && (
                            <form onSubmit={(e) => handlePay(inv.id, e)} className="flex flex-wrap items-end gap-3">
                              <Input
                                label="Nominal Bayar"
                                type="number"
                                min="1"
                                required
                                value={paymentForm.amount}
                                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                              />
                              <Input
                                label="Tanggal"
                                type="date"
                                required
                                value={paymentForm.payment_date}
                                onChange={(e) => setPaymentForm((f) => ({ ...f, payment_date: e.target.value }))}
                              />
                              <select
                                value={paymentForm.payment_method}
                                onChange={(e) => setPaymentForm((f) => ({ ...f, payment_method: e.target.value }))}
                                className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="cash">Tunai</option>
                                <option value="bank_transfer">Transfer Bank</option>
                                <option value="check">Cek</option>
                              </select>
                              <Button type="submit" size="sm" isLoading={isPaying}>
                                Catat Pembayaran
                              </Button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
