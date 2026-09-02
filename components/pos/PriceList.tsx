'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils/formatting'
import { colorForIndex } from '@/lib/utils/chartColors'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'

interface InventoryItem {
  product_id: string
  name: string
  sku: string
  barcode: string | null
  category_name: string | null
  unit_price: number
  quantity_available: number
}

export function PriceList({ outletId }: { outletId: string }) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/inventory/${outletId}`)
    const data = await res.json()
    if (res.ok) setItems(data.inventory ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  const needle = query.trim().toLowerCase()
  const visible = needle ? items.filter((i) => i.name.toLowerCase().includes(needle)) : items

  const categoryNames = Array.from(new Set(items.map((i) => i.category_name ?? 'Lainnya')))
  const grouped = new Map<string, InventoryItem[]>()
  for (const item of visible) {
    const cat = item.category_name ?? 'Lainnya'
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(item)
  }

  const csvRows = visible.map((i) => ({ produk: i.name, sku: i.sku, kategori: i.category_name ?? '', harga: i.unit_price, stok: i.quantity_available }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari produk…"
          className="w-full max-w-xs rounded-xl border-2 border-[var(--brand-100)] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <ExportCsvButton filename="daftar-harga" rows={csvRows} />
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-gray-400">Memuat…</p>
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">Produk tidak ditemukan</p>
      ) : (
        Array.from(grouped.entries()).map(([category, products]) => {
          const accent = colorForIndex(categoryNames.indexOf(category))
          return (
            <div key={category} className="overflow-hidden rounded-2xl border border-[var(--brand-100)] bg-white shadow-sm">
              <h3 className="border-b border-gray-100 px-4 py-2.5 text-sm font-bold" style={{ color: accent }}>
                {category}
              </h3>
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <tbody>
                  {products.map((p) => (
                    <tr key={p.product_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900">{p.name}</td>
                      <td className="px-4 py-2 text-gray-400">{p.sku}</td>
                      <td className="px-4 py-2 text-right font-semibold" style={{ color: accent }}>
                        {formatCurrency(p.unit_price)}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-400">Stok {p.quantity_available}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })
      )}
    </div>
  )
}
