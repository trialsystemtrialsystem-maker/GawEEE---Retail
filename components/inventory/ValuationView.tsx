'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { formatCurrency } from '@/lib/utils/formatting'
import { useResolvedOutlet } from '@/lib/hooks/useResolvedOutlet'

interface Item {
  product_id: string
  sku: string
  name: string
  category_name: string | null
  quantity_on_hand: number
  cost_value: number
  avg_cost_value: number
  avg_cost: number | null
  purchase_price: number
  retail_value: number
  sold_60d: number
  days_of_cover: number | null
  health: 'dead' | 'slow' | 'active' | 'empty'
  abc_class: 'A' | 'B' | 'C'
}

export function ValuationView() {
  const { outletId, isResolving, selectedOutlet, setSelectedOutlet } = useResolvedOutlet()
  const [items, setItems] = useState<Item[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!outletId) return
    setError(null)
    const res = await fetch(`/api/inventory/${outletId}?analytics=1`)
    const data = await res.json()
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Gagal memuat data')
      return
    }
    setItems(data.inventory ?? [])
  }, [outletId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const view = useMemo(() => {
    const cost = items.reduce((s, i) => s + i.cost_value, 0)
    const retail = items.reduce((s, i) => s + i.retail_value, 0)
    const avg = items.reduce((s, i) => s + i.avg_cost_value, 0)
    const byCategory = new Map<string, { sku: number; qty: number; cost: number }>()
    for (const i of items) {
      const k = i.category_name ?? 'Tanpa kategori'
      const e = byCategory.get(k) ?? { sku: 0, qty: 0, cost: 0 }
      e.sku += 1
      e.qty += i.quantity_on_hand
      e.cost += i.cost_value
      byCategory.set(k, e)
    }
    const abc = (['A', 'B', 'C'] as const).map((c) => ({ c, n: items.filter((i) => i.abc_class === c).length, v: items.filter((i) => i.abc_class === c).reduce((s, i) => s + i.cost_value, 0) }))
    return {
      cost,
      avg,
      retail,
      categories: Array.from(byCategory.entries()).sort((a, b) => b[1].cost - a[1].cost),
      abc,
      dead: items.filter((i) => i.health === 'dead').sort((a, b) => b.cost_value - a.cost_value),
      slow: items.filter((i) => i.health === 'slow').sort((a, b) => b.cost_value - a.cost_value),
    }
  }, [items])

  if (isResolving) return <p className="text-sm text-gray-400">Memuat…</p>
  const pct = (v: number) => (view.cost > 0 ? `${((v / view.cost) * 100).toFixed(1)}%` : '-')
  const th = 'px-3 py-2 font-semibold text-gray-600'

  const stuckTable = (title: string, hint: string, rows: Item[]) => (
    <Card className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title} <span className="text-sm font-normal text-gray-400">({rows.length} SKU · {formatCurrency(rows.reduce((s, r) => s + r.cost_value, 0))})</span></h2>
        <p className="text-sm text-gray-500">{hint}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">Tidak ada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className={`${th} text-left`}>Produk</th>
                <th className={`${th} text-right`}>Stok</th>
                <th className={`${th} text-right`}>Terjual 60h</th>
                <th className={`${th} text-right`}>Sisa Hari</th>
                <th className={`${th} text-right`}>Nilai Tertahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.slice(0, 25).map((r) => (
                <tr key={r.product_id}>
                  <td className="px-3 py-2 text-gray-900"><Link href={`/dashboard/inventory/stock-card?product_id=${r.product_id}`} className="hover:underline">{r.name}</Link></td>
                  <td className="px-3 py-2 text-right text-gray-700">{r.quantity_on_hand}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{r.sold_60d}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{r.days_of_cover === null ? '-' : `${r.days_of_cover} hr`}</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">{formatCurrency(r.cost_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <OutletSelector includeAll={false} value={selectedOutlet} onChange={setSelectedOutlet} />
        <ExportCsvButton
          filename="nilai-persediaan"
          rows={items.map((i) => ({ SKU: i.sku, Produk: i.name, Kategori: i.category_name ?? '', Stok: i.quantity_on_hand, 'Nilai (HPP master)': i.cost_value, 'Nilai (rata-rata beli)': i.avg_cost_value, 'Harga beli rata-rata': i.avg_cost ?? '', 'Nilai Jual': i.retail_value, ABC: i.abc_class, Pergerakan: i.health }))}
        />
      </div>
      {error && <Alert variant="danger">{error}</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card><p className="text-sm text-gray-500">Nilai Persediaan (HPP)</p><p className="text-xl font-bold text-gray-900">{formatCurrency(view.cost)}</p></Card>
        <Card><p className="text-sm text-gray-500">Nilai (rata-rata harga beli)</p><p className="text-xl font-bold text-gray-900">{formatCurrency(view.avg)}</p><p className="text-xs text-gray-400">{view.avg >= view.cost ? '+' : ''}{formatCurrency(view.avg - view.cost)} vs harga master</p></Card>
        <Card><p className="text-sm text-gray-500">Nilai Jual</p><p className="text-xl font-bold text-gray-900">{formatCurrency(view.retail)}</p></Card>
        <Card><p className="text-sm text-gray-500">Potensi Laba Kotor</p><p className="text-xl font-bold text-emerald-600">{formatCurrency(view.retail - view.cost)}</p></Card>
        <Card><p className="text-sm text-gray-500">Modal Tertahan (tidak bergerak)</p><p className="text-xl font-bold text-red-600">{formatCurrency(view.dead.reduce((s, r) => s + r.cost_value, 0))}</p><p className="text-xs text-gray-400">{pct(view.dead.reduce((s, r) => s + r.cost_value, 0))} dari total</p></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">Per Kategori</h2>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50"><tr><th className={`${th} text-left`}>Kategori</th><th className={`${th} text-right`}>SKU</th><th className={`${th} text-right`}>Nilai</th><th className={`${th} text-right`}>Porsi</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {view.categories.map(([name, c]) => (
                <tr key={name}>
                  <td className="px-3 py-2 text-gray-900">{name}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{c.sku}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(c.cost)}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{pct(c.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">Analisis ABC (nilai stok)</h2>
          <p className="text-sm text-gray-500">A = barang yang membentuk 80% nilai persediaan — paling perlu dijaga; C = ekor panjang bernilai kecil.</p>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50"><tr><th className={`${th} text-left`}>Kelas</th><th className={`${th} text-right`}>SKU</th><th className={`${th} text-right`}>Nilai</th><th className={`${th} text-right`}>Porsi</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {view.abc.map((a) => (
                <tr key={a.c}>
                  <td className="px-3 py-2 font-semibold text-gray-900">{a.c}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{a.n}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(a.v)}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{pct(a.v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {stuckTable('Barang Tidak Bergerak', 'Ada stok tetapi tidak ada penjualan dalam 60 hari terakhir — pertimbangkan promo, retur ke supplier, atau hapus.', view.dead)}
      {stuckTable('Barang Lambat', 'Dengan kecepatan jual sekarang, stok butuh lebih dari 90 hari untuk habis.', view.slow)}
    </div>
  )
}
