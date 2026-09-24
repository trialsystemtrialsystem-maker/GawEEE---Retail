'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { DateRangePicker, defaultDateRange, type DateRange } from '@/components/ui/DateRangePicker'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'
import { useResolvedOutlet } from '@/lib/hooks/useResolvedOutlet'

interface Entry {
  id: string
  product_name: string
  sku: string
  movement_type: string
  quantity_change: number
  unit_cost: number | null
  value: number | null
  reference_type: string | null
  notes: string | null
  batch_number: string | null
  expiry_date: string | null
  created_at: string
  recorded_by: string | null
  balance: number | null
}

export const MOVEMENT_LABEL: Record<string, string> = {
  purchase: 'Pembelian',
  sales: 'Penjualan',
  return: 'Retur Penjualan',
  purchase_return: 'Retur Pembelian',
  adjustment: 'Penyesuaian',
  waste: 'Waste / Rusak',
  write_off: 'Penghapusan',
  transfer: 'Transfer',
  transfer_in: 'Transfer Masuk',
  transfer_out: 'Transfer Keluar',
  production: 'Produksi',
  stocktake: 'Stok Opname',
}

export function StockCardView({ initialProductId }: { initialProductId?: string }) {
  const { outletId, isResolving, selectedOutlet, setSelectedOutlet } = useResolvedOutlet()
  const [products, setProducts] = useState<{ product_id: string; name: string; sku: string }[]>([])
  const [productId, setProductId] = useState(initialProductId ?? '')
  const [type, setType] = useState('')
  const [range, setRange] = useState<DateRange>(() => defaultDateRange(30))
  const [entries, setEntries] = useState<Entry[]>([])
  const [totals, setTotals] = useState({ in: 0, out: 0 })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!outletId) return
    let cancelled = false
    fetch(`/api/inventory/${outletId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setProducts((d.inventory ?? []).map((i: { product_id: string; name: string; sku: string }) => ({ product_id: i.product_id, name: i.name, sku: i.sku })))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [outletId])

  const load = useCallback(async () => {
    if (!outletId) return
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ outlet_id: outletId, start: range.start, end: range.end })
      if (productId) params.set('product_id', productId)
      if (type) params.set('type', type)
      const res = await fetch(`/api/inventory/ledger?${params}`)
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal memuat kartu stok')
        return
      }
      setEntries(data.entries ?? [])
      setTotals({ in: data.total_in ?? 0, out: data.total_out ?? 0 })
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setIsLoading(false)
    }
  }, [outletId, productId, type, range])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  if (isResolving) return <p className="text-sm text-gray-400">Memuat…</p>

  const csvRows = entries.map((e) => ({
    Waktu: e.created_at,
    Produk: e.product_name,
    SKU: e.sku,
    Jenis: MOVEMENT_LABEL[e.movement_type] ?? e.movement_type,
    Masuk: e.quantity_change > 0 ? e.quantity_change : '',
    Keluar: e.quantity_change < 0 ? -e.quantity_change : '',
    Saldo: e.balance ?? '',
    'Harga Satuan': e.unit_cost ?? '',
    Batch: e.batch_number ?? '',
    Kedaluwarsa: e.expiry_date ?? '',
    Oleh: e.recorded_by ?? '',
    Catatan: e.notes ?? '',
  }))
  const th = 'px-3 py-2 font-semibold text-gray-600'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <OutletSelector includeAll={false} value={selectedOutlet} onChange={setSelectedOutlet} />
        <div className="space-y-1">
          <label htmlFor="sc_product" className="block text-sm font-medium text-gray-700">Produk</label>
          <select id="sc_product" value={productId} onChange={(e) => setProductId(e.target.value)} className="max-w-xs rounded-sm border border-gray-200 px-3 py-2 text-sm">
            <option value="">Semua produk (log mutasi)</option>
            {products.map((p) => (
              <option key={p.product_id} value={p.product_id}>{p.name} ({p.sku})</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="sc_type" className="block text-sm font-medium text-gray-700">Jenis</label>
          <select id="sc_type" value={type} onChange={(e) => setType(e.target.value)} className="rounded-sm border border-gray-200 px-3 py-2 text-sm">
            <option value="">Semua</option>
            {Object.entries(MOVEMENT_LABEL).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
        <ExportCsvButton filename={`kartu-stok-${range.start}_${range.end}`} rows={csvRows} />
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="grid grid-cols-3 gap-3">
        <Card><p className="text-sm text-gray-500">Total Masuk</p><p className="text-xl font-bold text-emerald-600">+{totals.in}</p></Card>
        <Card><p className="text-sm text-gray-500">Total Keluar</p><p className="text-xl font-bold text-red-600">-{totals.out}</p></Card>
        <Card><p className="text-sm text-gray-500">Jumlah Mutasi</p><p className="text-xl font-bold text-gray-900">{entries.length}</p></Card>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className={`${th} text-left`}>Waktu</th>
              {!productId && <th className={`${th} text-left`}>Produk</th>}
              <th className={`${th} text-left`}>Jenis</th>
              <th className={`${th} text-right`}>Masuk</th>
              <th className={`${th} text-right`}>Keluar</th>
              {productId && <th className={`${th} text-right`}>Saldo</th>}
              <th className={`${th} text-right`}>Harga</th>
              <th className={`${th} text-left`}>Batch</th>
              <th className={`${th} text-left`}>Oleh</th>
              <th className={`${th} text-left`}>Catatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-400">Tidak ada mutasi pada periode ini</td></tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDateTime(e.created_at)}</td>
                  {!productId && <td className="px-3 py-2 text-gray-900">{e.product_name}</td>}
                  <td className="px-3 py-2 text-gray-700">{MOVEMENT_LABEL[e.movement_type] ?? e.movement_type}</td>
                  <td className="px-3 py-2 text-right text-emerald-600">{e.quantity_change > 0 ? `+${e.quantity_change}` : ''}</td>
                  <td className="px-3 py-2 text-right text-red-600">{e.quantity_change < 0 ? e.quantity_change : ''}</td>
                  {productId && <td className="px-3 py-2 text-right font-medium text-gray-900">{e.balance}</td>}
                  <td className="px-3 py-2 text-right text-gray-600">{e.unit_cost !== null ? formatCurrency(e.unit_cost) : '-'}</td>
                  <td className="px-3 py-2 text-gray-500">{e.batch_number ?? '-'}</td>
                  <td className="px-3 py-2 text-gray-500">{e.recorded_by ?? '-'}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-gray-500" title={e.notes ?? ''}>{e.notes ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
