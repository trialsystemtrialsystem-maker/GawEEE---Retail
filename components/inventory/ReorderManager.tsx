'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { formatCurrency } from '@/lib/utils/formatting'
import { useResolvedOutlet } from '@/lib/hooks/useResolvedOutlet'
import { useNotificationStore } from '@/store/notificationStore'

interface Item {
  product_id: string
  sku: string
  name: string
  supplier_id: string | null
  supplier_name: string | null
  unit_type: string
  purchase_price: number
  quantity_on_hand: number
  reorder_level: number
  avg_daily_sales: number
  days_of_cover: number | null
  suggested_reorder: number
}

export function ReorderManager({ canCreate }: { canCreate: boolean }) {
  const { outletId, isResolving, selectedOutlet, setSelectedOutlet } = useResolvedOutlet()
  const [items, setItems] = useState<Item[]>([])
  const [qty, setQty] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [created, setCreated] = useState<string[]>([])
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    if (!outletId) return
    setError(null)
    const res = await fetch(`/api/inventory/${outletId}?analytics=1`)
    const data = await res.json()
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Gagal memuat rekomendasi')
      return
    }
    const list = (data.inventory as Item[]).filter((i) => i.suggested_reorder > 0)
    setItems(list)
    setQty(Object.fromEntries(list.map((i) => [i.product_id, String(i.suggested_reorder)])))
  }, [outletId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: Item[] }>()
    for (const i of items) {
      const key = i.supplier_id ?? 'none'
      const g = map.get(key) ?? { name: i.supplier_name ?? 'Tanpa supplier', items: [] }
      g.items.push(i)
      map.set(key, g)
    }
    return Array.from(map.entries())
  }, [items])

  async function createPo(supplierId: string, group: Item[]) {
    setBusy(supplierId)
    setError(null)
    try {
      const lines = group.map((i) => ({ product_id: i.product_id, quantity: Math.floor(Number(qty[i.product_id])), unit_cost: i.purchase_price })).filter((l) => l.quantity > 0)
      if (lines.length === 0) return setError('Isi jumlah pesan minimal untuk satu barang')
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, supplier_id: supplierId, items: lines, notes: 'Dibuat dari rekomendasi pemesanan' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal membuat PO')
        return
      }
      showToast('PO draft dibuat', 'success')
      setCreated((c) => [...c, supplierId])
    } finally {
      setBusy(null)
    }
  }

  if (isResolving) return <p className="text-sm text-gray-400">Memuat…</p>

  const total = (g: Item[]) => g.reduce((s, i) => s + Math.max(0, Math.floor(Number(qty[i.product_id]) || 0)) * i.purchase_price, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <OutletSelector includeAll={false} value={selectedOutlet} onChange={setSelectedOutlet} />
        <ExportCsvButton
          filename="rekomendasi-pemesanan"
          rows={items.map((i) => ({ SKU: i.sku, Produk: i.name, Supplier: i.supplier_name ?? '', Stok: i.quantity_on_hand, 'Titik Pesan': i.reorder_level, 'Terjual/hari': i.avg_daily_sales, 'Sisa Hari': i.days_of_cover ?? '', 'Saran Pesan': i.suggested_reorder, 'Harga Beli': i.purchase_price }))}
        />
      </div>
      <Alert variant="info">
        Saran dihitung dari stok, titik pesan, dan kecepatan terjual 30 hari terakhir (waktu kirim 7 hari + cadangan 14 hari). Ubah jumlahnya sebelum membuat PO draft.
      </Alert>
      {error && <Alert variant="danger">{error}</Alert>}
      {groups.length === 0 && <p className="text-gray-500">Semua stok masih aman — tidak ada yang perlu dipesan.</p>}

      {groups.map(([supplierId, g]) => (
        <Card key={supplierId} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{g.name}</h2>
            {supplierId === 'none' ? (
              <span className="text-sm text-amber-600">Tetapkan supplier di data produk agar bisa dibuat PO.</span>
            ) : canCreate ? (
              <Button size="sm" onClick={() => createPo(supplierId, g.items)} isLoading={busy === supplierId} disabled={created.includes(supplierId)}>
                {created.includes(supplierId) ? 'PO dibuat ✓' : `Buat PO Draft (${formatCurrency(total(g.items))})`}
              </Button>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Produk</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Stok</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Titik Pesan</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Sisa Hari</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Harga Beli</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Jumlah Pesan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {g.items.map((i) => (
                  <tr key={i.product_id}>
                    <td className="px-3 py-2 text-gray-900">
                      <Link href={`/dashboard/inventory/stock-card?product_id=${i.product_id}`} className="hover:underline">{i.name}</Link>
                      <span className="block text-xs text-gray-400">{i.sku}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">{i.quantity_on_hand}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{i.reorder_level}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{i.days_of_cover === null ? '-' : `${i.days_of_cover} hr`}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(i.purchase_price)}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        aria-label={`Jumlah pesan ${i.name}`}
                        className="w-24 rounded-sm border border-gray-200 px-2 py-1 text-right text-sm"
                        value={qty[i.product_id] ?? ''}
                        onChange={(e) => setQty((q) => ({ ...q, [i.product_id]: e.target.value }))}
                      />{' '}
                      <span className="text-xs text-gray-400">{i.unit_type}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  )
}
