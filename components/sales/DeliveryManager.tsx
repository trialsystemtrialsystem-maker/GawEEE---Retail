'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Invoice {
  id: string
  invoice_number: string
  customer_name: string | null
  total: number
}
interface Delivery {
  id: string
  invoice_id: string
  courier_name: string | null
  tracking_number: string | null
  status: 'preparing' | 'shipped' | 'delivered'
  shipped_at: string | null
  delivered_at: string | null
  invoices: { invoice_number: string; customer_name: string | null; total: number } | null
}

const STATUS_LABEL: Record<Delivery['status'], string> = { preparing: 'Disiapkan', shipped: 'Dikirim', delivered: 'Sampai' }
const STATUS_STYLE: Record<Delivery['status'], string> = {
  preparing: 'bg-amber-50 text-amber-700',
  shipped: 'bg-blue-50 text-blue-700',
  delivered: 'bg-emerald-50 text-emerald-700',
}
const NEXT_STATUS: Record<Delivery['status'], Delivery['status'] | null> = { preparing: 'shipped', shipped: 'delivered', delivered: null }

export function DeliveryManager({ outletId }: { outletId: string }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [invoiceId, setInvoiceId] = useState('')
  const [courierName, setCourierName] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [deliveryRes, invoiceRes] = await Promise.all([
      fetch(`/api/sales-deliveries?outlet_id=${outletId}`),
      fetch(`/api/invoices?outlet_id=${outletId}&limit=100`),
    ])
    const deliveryData = await deliveryRes.json()
    const invoiceData = await invoiceRes.json()
    if (deliveryRes.ok) setDeliveries(deliveryData.deliveries ?? [])
    if (invoiceRes.ok) {
      const deliveredIds = new Set((deliveryData.deliveries ?? []).map((d: Delivery) => d.invoice_id))
      setInvoices((invoiceData.invoices ?? []).filter((i: Invoice) => !deliveredIds.has(i.id)))
    }
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/sales-deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId, courier_name: courierName || undefined, tracking_number: trackingNumber || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal mencatat pengiriman', 'danger')
        return
      }
      setInvoiceId('')
      setCourierName('')
      setTrackingNumber('')
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAdvance(delivery: Delivery, status: string) {
    setBusyId(delivery.id)
    try {
      await fetch(`/api/sales-deliveries/${delivery.id}`, {
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
      <Alert variant="info">Pencatatan manual — belum terhubung ke API kurir manapun (JNE/J&T/dll). Status diperbarui oleh staf secara manual.</Alert>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Catat Pengiriman'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Invoice</label>
            <select
              required
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Pilih invoice…</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} — {inv.customer_name ?? 'Tanpa nama'} ({formatCurrency(inv.total)})
                </option>
              ))}
            </select>
          </div>
          <Input name="courier_name" label="Kurir (opsional)" value={courierName} onChange={(e) => setCourierName(e.target.value)} placeholder="mis. JNE, Gojek" />
          <Input name="tracking_number" label="No. Resi (opsional)" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
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
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Invoice</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Kurir</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">No. Resi</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : deliveries.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada pengiriman tercatat</td></tr>
            ) : (
              deliveries.map((d) => {
                const next = NEXT_STATUS[d.status]
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">
                      {d.invoices?.invoice_number ?? '-'}
                      <p className="text-xs text-gray-400">{d.invoices?.customer_name ?? 'Tanpa nama'}</p>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{d.courier_name ?? '-'}</td>
                    <td className="px-4 py-2 text-gray-600">{d.tracking_number ?? '-'}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                      {d.shipped_at && <p className="mt-0.5 text-[11px] text-gray-400">Dikirim: {formatDateTime(d.shipped_at)}</p>}
                      {d.delivered_at && <p className="text-[11px] text-gray-400">Sampai: {formatDateTime(d.delivered_at)}</p>}
                    </td>
                    <td className="px-4 py-2">
                      {next && (
                        <button disabled={busyId === d.id} onClick={() => handleAdvance(d, next)} className="text-xs font-medium text-[var(--brand-600)] hover:underline disabled:opacity-50">
                          Tandai {STATUS_LABEL[next]}
                        </button>
                      )}
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
