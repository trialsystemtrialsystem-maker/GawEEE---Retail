'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface PO {
  id: string
  po_number: string
  status: string
  supplier_id: string
  order_date: string
  requested_delivery_date: string | null
  actual_delivery_date: string | null
  subtotal: number | null
  tax_amount: number | null
  total: number | null
  notes: string | null
  suppliers: { name: string } | null
  outlets: { name: string } | null
}
interface Item {
  id: string
  quantity_ordered: number
  quantity_received: number
  unit_cost: number
  subtotal: number
  products: { name: string; sku: string } | null
}
interface Receipt {
  id: string
  quantity: number
  unit_cost: number | null
  batch_number: string | null
  expiry_date: string | null
  received_at: string
  product_name: string
  received_by: string | null
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Menunggu Persetujuan',
  ordered: 'Dipesan',
  partial_received: 'Diterima Sebagian',
  received: 'Diterima Lengkap',
  cancelled: 'Dibatalkan',
}
const STEPS = ['draft', 'pending_approval', 'ordered', 'partial_received', 'received']

function printPo(po: PO, items: Item[]) {
  const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)
  const rows = items
    .map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.products?.name ?? '-')}<br/><small>${esc(i.products?.sku ?? '')}</small></td><td style="text-align:right">${i.quantity_ordered}</td><td style="text-align:right">${formatCurrency(i.unit_cost)}</td><td style="text-align:right">${formatCurrency(i.subtotal)}</td></tr>`)
    .join('')
  const w = window.open('', '_blank', 'width=820,height=900')
  if (!w) return
  w.document.write(`<html><head><title>${esc(po.po_number)}</title><style>body{font-family:sans-serif;padding:32px;color:#111}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}th{background:#f5f5f5}.sig{display:flex;justify-content:space-between;margin-top:72px}.sig div{width:30%;border-top:1px solid #333;text-align:center;padding-top:4px;font-size:12px}</style></head><body>
<h2 style="margin:0">PURCHASE ORDER</h2><p style="margin:2px 0 16px">${esc(po.po_number)}</p>
<table style="margin:0"><tr><td><strong>Kepada</strong><br/>${esc(po.suppliers?.name ?? '-')}</td><td><strong>Dikirim ke</strong><br/>${esc(po.outlets?.name ?? '-')}</td><td><strong>Tanggal</strong><br/>${formatDate(po.order_date)}<br/><strong>Target kirim</strong><br/>${po.requested_delivery_date ? formatDate(po.requested_delivery_date) : '-'}</td></tr></table>
<table><thead><tr><th>#</th><th>Barang</th><th style="text-align:right">Qty</th><th style="text-align:right">Harga</th><th style="text-align:right">Subtotal</th></tr></thead><tbody>${rows}</tbody>
<tfoot><tr><td colspan="4" style="text-align:right">Subtotal</td><td style="text-align:right">${formatCurrency(po.subtotal ?? 0)}</td></tr><tr><td colspan="4" style="text-align:right">Pajak</td><td style="text-align:right">${formatCurrency(po.tax_amount ?? 0)}</td></tr><tr><td colspan="4" style="text-align:right"><strong>Total</strong></td><td style="text-align:right"><strong>${formatCurrency(po.total ?? 0)}</strong></td></tr></tfoot></table>
${po.notes ? `<p><strong>Catatan:</strong> ${esc(po.notes)}</p>` : ''}
<div class="sig"><div>Dibuat oleh</div><div>Disetujui oleh</div><div>Supplier</div></div></body></html>`)
  w.document.close()
  w.print()
}

export function PurchaseOrderDetail({ poId, canManage }: { poId: string; canManage: boolean }) {
  const [po, setPo] = useState<PO | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [recv, setRecv] = useState<Record<string, { qty: string; batch: string; expiry: string }>>({})
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    const [d, r] = await Promise.all([fetch(`/api/purchase-orders/${poId}`), fetch(`/api/purchase-orders/${poId}/receipts`)])
    const detail = await d.json()
    if (!d.ok) return setError(typeof detail.error === 'string' ? detail.error : 'Gagal memuat PO')
    setPo(detail.purchase_order)
    setItems(detail.items ?? [])
    setRecv(Object.fromEntries((detail.items as Item[]).map((i) => [i.id, { qty: String(Math.max(0, i.quantity_ordered - i.quantity_received)), batch: '', expiry: '' }])))
    if (r.ok) setReceipts((await r.json()).receipts ?? [])
  }, [poId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function act(action: 'submit' | 'approve' | 'reject') {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/${action}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) return setError(typeof data.error === 'string' ? data.error : 'Aksi gagal')
      showToast('PO diperbarui', 'success')
      load()
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    const reason = window.prompt('Alasan pembatalan PO (wajib):')
    if (!reason) return
    setBusy(true)
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
      const data = await res.json()
      if (!res.ok) return setError(typeof data.error === 'string' ? data.error : 'Gagal membatalkan')
      showToast('PO dibatalkan', 'success')
      load()
    } finally {
      setBusy(false)
    }
  }

  async function receive(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const lines = items
      .map((i) => ({ item: i, r: recv[i.id] }))
      .filter(({ r }) => r && Number(r.qty) > 0)
      .map(({ item, r }) => ({ po_item_id: item.id, quantity_received: Math.floor(Number(r.qty)), batch_number: r.batch || undefined, expiry_date: r.expiry || undefined }))
    if (lines.length === 0) return setError('Isi jumlah diterima untuk minimal satu barang')
    setBusy(true)
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/receive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: lines, delivery_date: deliveryDate }) })
      const data = await res.json()
      if (!res.ok) return setError(typeof data.error === 'string' ? data.error : 'Gagal menerima barang')
      showToast(`Barang diterima — ${STATUS_LABEL[data.po_status] ?? data.po_status}`, 'success')
      load()
    } finally {
      setBusy(false)
    }
  }

  if (error && !po) return <Alert variant="danger">{error}</Alert>
  if (!po) return <p className="text-gray-400">Memuat…</p>

  const receivable = ['ordered', 'partial_received'].includes(po.status) && canManage
  const stepIndex = STEPS.indexOf(po.status)
  const orderedQty = items.reduce((s, i) => s + i.quantity_ordered, 0)
  const receivedQty = items.reduce((s, i) => s + i.quantity_received, 0)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/suppliers/purchase-orders" className="text-sm text-brand-600 hover:underline">← Daftar Purchase Order</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-900">{po.po_number}</h1>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => printPo(po, items)}>Cetak PO</Button>
            {canManage && po.status === 'draft' && <Button size="sm" onClick={() => act('submit')} isLoading={busy}>Ajukan Persetujuan</Button>}
            {canManage && po.status === 'pending_approval' && (
              <>
                <Button size="sm" onClick={() => act('approve')} isLoading={busy}>Setujui</Button>
                <Button size="sm" variant="secondary" onClick={() => act('reject')} isLoading={busy}>Tolak</Button>
              </>
            )}
            {canManage && ['draft', 'pending_approval', 'ordered'].includes(po.status) && receivedQty === 0 && (
              <Button size="sm" variant="secondary" onClick={cancel} isLoading={busy}>Batalkan PO</Button>
            )}
          </div>
        </div>
        <p className="text-gray-500">
          <Link href={`/dashboard/suppliers/${po.supplier_id}`} className="hover:underline">{po.suppliers?.name ?? '-'}</Link> → {po.outlets?.name ?? '-'} · dipesan {formatDate(po.order_date)}
          {po.requested_delivery_date && ` · target ${formatDate(po.requested_delivery_date)}`}
          {po.actual_delivery_date && ` · terakhir diterima ${formatDate(po.actual_delivery_date)}`}
        </p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {po.status === 'cancelled' ? (
        <Alert variant="warning">PO ini dibatalkan.{po.notes ? ` ${po.notes.split('\n').at(-1)}` : ''}</Alert>
      ) : (
        <ol className="flex flex-wrap gap-2 text-sm">
          {STEPS.map((step, i) => (
            <li key={step} className={`rounded-full px-3 py-1 ${i < stepIndex ? 'bg-emerald-50 text-emerald-700' : i === stepIndex ? 'bg-brand-500 font-medium text-white' : 'bg-gray-100 text-gray-400'}`}>
              {i < stepIndex ? '✓ ' : ''}{STATUS_LABEL[step]}
            </li>
          ))}
        </ol>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><p className="text-sm text-gray-500">Total PO</p><p className="text-xl font-bold text-gray-900">{formatCurrency(po.total ?? 0)}</p></Card>
        <Card><p className="text-sm text-gray-500">Jumlah Dipesan</p><p className="text-xl font-bold text-gray-900">{orderedQty}</p></Card>
        <Card><p className="text-sm text-gray-500">Sudah Diterima</p><p className="text-xl font-bold text-emerald-600">{receivedQty}</p></Card>
        <Card><p className="text-sm text-gray-500">Belum Diterima</p><p className={`text-xl font-bold ${orderedQty - receivedQty > 0 && po.status !== 'cancelled' ? 'text-amber-600' : 'text-gray-900'}`}>{po.status === 'cancelled' ? 0 : orderedQty - receivedQty}</p></Card>
      </div>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">{receivable ? 'Terima Barang' : 'Barang'}</h2>
        <form onSubmit={receive} className="space-y-3">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Barang</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Dipesan</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Diterima</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Sisa</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Harga</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Subtotal</th>
                  {receivable && <th className="px-3 py-2 text-left font-semibold text-gray-600">Terima sekarang</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((i) => {
                  const remaining = Math.max(0, i.quantity_ordered - i.quantity_received)
                  const r = recv[i.id]
                  return (
                    <tr key={i.id}>
                      <td className="px-3 py-2 text-gray-900">{i.products?.name ?? '-'}<span className="block text-xs text-gray-400">{i.products?.sku}</span></td>
                      <td className="px-3 py-2 text-right text-gray-700">{i.quantity_ordered}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{i.quantity_received}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{remaining}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(i.unit_cost)}</td>
                      <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(i.subtotal)}</td>
                      {receivable && (
                        <td className="px-3 py-2">
                          {remaining > 0 && r ? (
                            <div className="flex flex-wrap items-center gap-1">
                              <input type="number" min="0" max={remaining} aria-label={`Jumlah diterima ${i.products?.name}`} value={r.qty} onChange={(e) => setRecv((s) => ({ ...s, [i.id]: { ...r, qty: e.target.value } }))} className="w-20 rounded-sm border border-gray-200 px-2 py-1 text-right text-sm" />
                              <input placeholder="Batch" aria-label={`Batch ${i.products?.name}`} value={r.batch} onChange={(e) => setRecv((s) => ({ ...s, [i.id]: { ...r, batch: e.target.value } }))} className="w-24 rounded-sm border border-gray-200 px-2 py-1 text-sm" />
                              <input type="date" aria-label={`Kedaluwarsa ${i.products?.name}`} value={r.expiry} onChange={(e) => setRecv((s) => ({ ...s, [i.id]: { ...r, expiry: e.target.value } }))} className="rounded-sm border border-gray-200 px-2 py-1 text-sm" />
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Lengkap</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {receivable && (
            <div className="flex flex-wrap items-end gap-3">
              <Input name="delivery_date" label="Tanggal diterima" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              <Button type="submit" isLoading={busy}>Catat Penerimaan</Button>
            </div>
          )}
        </form>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">Riwayat Penerimaan</h2>
        {receipts.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada penerimaan.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <tbody className="divide-y divide-gray-100">
              {receipts.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 text-gray-500">{formatDateTime(r.received_at)}</td>
                  <td className="px-3 py-2 text-gray-900">{r.product_name}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">+{r.quantity}</td>
                  <td className="px-3 py-2 text-gray-500">{r.batch_number ? `Batch ${r.batch_number}` : ''}{r.expiry_date ? ` · exp ${formatDate(r.expiry_date)}` : ''}</td>
                  <td className="px-3 py-2 text-gray-400">{r.received_by ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
