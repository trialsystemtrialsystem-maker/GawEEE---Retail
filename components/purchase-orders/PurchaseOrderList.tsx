'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'

interface Supplier {
  id: string
  name: string
}
interface Product {
  id: string
  name: string
  purchase_price: number
}
interface POLine {
  product_id: string
  quantity: number
  unit_cost: number
}
interface PORow {
  id: string
  po_number: string
  status: string
  total: number | null
  order_date: string
  suppliers: { name: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Menunggu Persetujuan',
  ordered: 'Dipesan',
  partial_received: 'Diterima Sebagian',
  received: 'Diterima',
  cancelled: 'Dibatalkan',
}

export function PurchaseOrderList({ outletId }: { outletId: string }) {
  const [pos, setPos] = useState<PORow[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [lines, setLines] = useState<POLine[]>([{ product_id: '', quantity: 1, unit_cost: 0 }])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [poRes, supplierRes, productRes] = await Promise.all([
      fetch('/api/purchase-orders'),
      fetch('/api/suppliers'),
      fetch('/api/products?limit=200'),
    ])
    const [poData, supplierData, productData] = await Promise.all([poRes.json(), supplierRes.json(), productRes.json()])
    if (poRes.ok) setPos(poData.purchase_orders ?? [])
    if (supplierRes.ok) setSuppliers(supplierData.suppliers ?? [])
    if (productRes.ok) setProducts(productData.data ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  function updateLine(index: number, patch: Partial<POLine>) {
    setLines((ls) => ls.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines((ls) => [...ls, { product_id: '', quantity: 1, unit_cost: 0 }])
  }

  function removeLine(index: number) {
    setLines((ls) => ls.filter((_, i) => i !== index))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    const validLines = lines.filter((l) => l.product_id && l.quantity > 0)
    if (!supplierId || validLines.length === 0) {
      setError('Pilih supplier dan minimal 1 produk')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, supplier_id: supplierId, items: validLines }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal membuat PO')
        return
      }
      setNotice(`PO ${data.po_number} berhasil dibuat (draft).`)
      setSupplierId('')
      setLines([{ product_id: '', quantity: 1, unit_cost: 0 }])
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAction(po: PORow, action: 'submit' | 'approve') {
    setBusyId(po.id)
    setError(null)
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/${action}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal memproses PO')
        return
      }
      load()
    } finally {
      setBusyId(null)
    }
  }

  async function handleReceive(po: PORow) {
    setBusyId(po.id)
    setError(null)
    try {
      const detailRes = await fetch(`/api/purchase-orders/${po.id}`)
      const detail = await detailRes.json()
      if (!detailRes.ok) {
        setError('Gagal memuat detail PO')
        return
      }
      const items = (detail.items ?? []) as { id: string; quantity_ordered: number; quantity_received: number; products: { name: string } | null }[]
      const receiveItems = []
      for (const item of items) {
        const remaining = item.quantity_ordered - item.quantity_received
        if (remaining <= 0) continue
        const input = window.prompt(
          `${item.products?.name ?? item.id} — sisa ${remaining}. Jumlah diterima sekarang?`,
          String(remaining)
        )
        if (input === null) continue
        const qty = Number(input)
        if (!Number.isFinite(qty) || qty <= 0) continue
        const batchNumber = window.prompt(`No. Batch untuk ${item.products?.name ?? item.id} (opsional, kosongkan untuk lewati)`) || undefined
        const expiryDate = window.prompt(`Tanggal kadaluarsa untuk ${item.products?.name ?? item.id}, format YYYY-MM-DD (opsional)`) || undefined
        receiveItems.push({ po_item_id: item.id, quantity_received: qty, batch_number: batchNumber, expiry_date: expiryDate })
      }
      if (receiveItems.length === 0) return

      const res = await fetch(`/api/purchase-orders/${po.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: receiveItems }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menerima barang')
        return
      }
      setNotice(`Barang diterima. Status PO: ${STATUS_LABEL[data.po_status] ?? data.po_status}`)
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Purchase Order</h2>
        <div className="flex gap-2">
          <ExportCsvButton filename="purchase-orders" rows={pos} />
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Batal' : '+ Buat PO'}
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
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

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Item</label>
              {lines.map((line, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <select
                    value={line.product_id}
                    onChange={(e) => {
                      const product = products.find((p) => p.id === e.target.value)
                      updateLine(i, {
                        product_id: e.target.value,
                        unit_cost: product?.purchase_price ?? line.unit_cost,
                      })
                    }}
                    className="min-w-[180px] flex-1 rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Pilih produk…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={1}
                    className="w-24"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                  />
                  <Input
                    type="number"
                    min={0}
                    className="w-32"
                    value={line.unit_cost}
                    onChange={(e) => updateLine(i, { unit_cost: Number(e.target.value) })}
                  />
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
              Simpan PO
            </Button>
          </form>
        </Card>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">No. PO</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Supplier</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Total</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : pos.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Belum ada purchase order</td></tr>
            ) : (
              pos.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{po.po_number}</td>
                  <td className="px-4 py-2 text-gray-600">{po.suppliers?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-600">{formatDate(po.order_date)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(po.total ?? 0)}</td>
                  <td className="px-4 py-2 text-gray-600">{STATUS_LABEL[po.status] ?? po.status}</td>
                  <td className="px-4 py-2">
                    {po.status === 'draft' && (
                      <Button size="sm" variant="secondary" isLoading={busyId === po.id} onClick={() => handleAction(po, 'submit')}>
                        Submit
                      </Button>
                    )}
                    {po.status === 'pending_approval' && (
                      <Button size="sm" variant="secondary" isLoading={busyId === po.id} onClick={() => handleAction(po, 'approve')}>
                        Approve
                      </Button>
                    )}
                    {(po.status === 'ordered' || po.status === 'partial_received') && (
                      <Button size="sm" variant="secondary" isLoading={busyId === po.id} onClick={() => handleReceive(po)}>
                        Terima Barang
                      </Button>
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
