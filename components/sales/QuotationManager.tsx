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
interface QuotationItem {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
  products: { name: string } | null
}
interface Quotation {
  id: string
  customer_name: string
  customer_phone: string | null
  quotation_number: string
  quotation_date: string
  valid_until: string | null
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
  invoice_id: string | null
  sales_quotation_items: QuotationItem[]
}
interface DraftLine {
  product_id: string
  quantity: number
  unit_price: string
}

const STATUS_LABEL: Record<Quotation['status'], string> = { draft: 'Draft', sent: 'Terkirim', accepted: 'Diterima', rejected: 'Ditolak', expired: 'Kedaluwarsa' }
const STATUS_STYLE: Record<Quotation['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-50 text-blue-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  expired: 'bg-amber-50 text-amber-700',
}
const NEXT_STATUS: Record<Quotation['status'], Quotation['status'] | null> = { draft: 'sent', sent: null, accepted: null, rejected: null, expired: null }

export function QuotationManager({ outletId }: { outletId: string }) {
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([{ product_id: '', quantity: 1, unit_price: '' }])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [quotationRes, productRes] = await Promise.all([fetch(`/api/sales-quotations?outlet_id=${outletId}`), fetch('/api/products?limit=200')])
    const quotationData = await quotationRes.json()
    const productData = await productRes.json()
    if (quotationRes.ok) setQuotations(quotationData.quotations ?? [])
    if (productRes.ok) setProducts(productData.data ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

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
      const res = await fetch('/api/sales-quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          customer_name: customerName,
          customer_phone: customerPhone || undefined,
          valid_until: validUntil || undefined,
          items: validLines.map((l) => ({ product_id: l.product_id, quantity: l.quantity, unit_price: Number(l.unit_price) })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal membuat quotation', 'danger')
        return
      }
      setCustomerName('')
      setCustomerPhone('')
      setValidUntil('')
      setLines([{ product_id: '', quantity: 1, unit_price: '' }])
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleStatusChange(quotation: Quotation, status: string) {
    setBusyId(quotation.id)
    try {
      await fetch(`/api/sales-quotations/${quotation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      load()
    } finally {
      setBusyId(null)
    }
  }

  async function handleConvert(quotation: Quotation) {
    setBusyId(quotation.id)
    try {
      const res = await fetch(`/api/sales-quotations/${quotation.id}/convert`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal mengonversi ke invoice', 'danger')
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
          {showForm ? 'Batal' : '+ Buat Quotation'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label="Nama Pelanggan" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <Input label="Telepon (opsional)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            <Input label="Berlaku Sampai (opsional)" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Item Quotation</label>
            {lines.map((line, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <select
                  value={line.product_id}
                  onChange={(e) => updateLine(i, { product_id: e.target.value })}
                  className="min-w-[180px] flex-1 rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            Simpan Quotation
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">No. Quotation</th>
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
            ) : quotations.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Belum ada quotation</td></tr>
            ) : (
              quotations.map((q) => {
                const total = q.sales_quotation_items.reduce((s, i) => s + i.subtotal, 0)
                const next = NEXT_STATUS[q.status]
                return (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {q.quotation_number}
                      <p className="text-xs font-normal text-gray-400">{formatDate(q.quotation_date)}</p>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{q.customer_name}</td>
                    <td className="px-4 py-2 text-gray-600">{q.sales_quotation_items.map((i) => `${i.products?.name ?? '?'} x${i.quantity}`).join(', ')}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(total)}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[q.status]}`}>{STATUS_LABEL[q.status]}</span>
                      {q.invoice_id && <p className="mt-0.5 text-[11px] text-emerald-600">Sudah jadi invoice</p>}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        {next && (
                          <button disabled={busyId === q.id} onClick={() => handleStatusChange(q, next)} className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50">
                            Tandai {STATUS_LABEL[next]}
                          </button>
                        )}
                        {q.status === 'sent' && (
                          <>
                            <button disabled={busyId === q.id} onClick={() => handleStatusChange(q, 'accepted')} className="text-xs font-medium text-emerald-600 hover:underline disabled:opacity-50">
                              Diterima
                            </button>
                            <button disabled={busyId === q.id} onClick={() => handleStatusChange(q, 'rejected')} className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50">
                              Ditolak
                            </button>
                          </>
                        )}
                        {q.status === 'accepted' && !q.invoice_id && (
                          <button disabled={busyId === q.id} onClick={() => handleConvert(q)} className="text-xs font-medium text-[var(--brand-600)] hover:underline disabled:opacity-50">
                            Convert to Invoice
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

      {!isLoading && quotations.length === 0 && <Alert variant="info">Buat quotation di atas untuk memulai.</Alert>}
    </div>
  )
}
