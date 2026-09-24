'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils/formatting'

interface Product {
  product_id: string
  name: string
  sku: string
  category: string | null
  total_quantity: number
  total_value: number
  stocks: { outlet_id: string; outlet_name: string; quantity: number; reorder_level: number }[]
  transfers: { from_outlet_name: string; to_outlet_name: string; quantity: number }[]
}

export function StockAcrossOutlets() {
  const [outlets, setOutlets] = useState<{ id: string; name: string }[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/inventory/overview')
        const data = await res.json()
        if (!res.ok) setError(typeof data.error === 'string' ? data.error : 'Gagal memuat data')
        else {
          setOutlets(data.outlets ?? [])
          setProducts(data.products ?? [])
        }
      } catch {
        setError('Terjadi kesalahan jaringan')
      } finally {
        setIsLoading(false)
      }
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return products.filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle))
  }, [products, search])
  const suggestions = useMemo(() => products.flatMap((p) => p.transfers.map((t) => ({ ...t, name: p.name, product_id: p.product_id }))), [products])
  const qtyAt = (p: Product, outletId: string) => p.stocks.find((s) => s.outlet_id === outletId)

  const csvRows = shown.map((p) => ({ SKU: p.sku, Produk: p.name, ...Object.fromEntries(outlets.map((o) => [o.name, qtyAt(p, o.id)?.quantity ?? ''])), Total: p.total_quantity, 'Nilai (HPP)': p.total_value }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <Input placeholder="Cari nama atau SKU…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Cari produk" />
        </div>
        <ExportCsvButton filename="stok-semua-outlet" rows={csvRows} />
      </div>
      {error && <Alert variant="danger">{error}</Alert>}

      {suggestions.length > 0 && (
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">Saran Transfer Antar Outlet ({suggestions.length})</h2>
          <p className="text-sm text-gray-500">Outlet yang kelebihan stok bisa mengirim ke outlet yang sudah di bawah titik pesan — lebih murah daripada membeli baru.</p>
          <ul className="space-y-1 text-sm">
            {suggestions.slice(0, 15).map((s, i) => (
              <li key={`${s.product_id}-${i}`} className="text-gray-700">
                <strong>{s.quantity}</strong> × <Link href={`/dashboard/inventory/stock-card?product_id=${s.product_id}`} className="hover:underline">{s.name}</Link>: {s.from_outlet_name} → {s.to_outlet_name}
              </li>
            ))}
          </ul>
          <Link href="/dashboard/inventory/mutation/transfer" className="text-sm text-brand-600 hover:underline">Buat transfer stok →</Link>
        </Card>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Produk</th>
              {outlets.map((o) => (
                <th key={o.id} className="px-3 py-2 text-right font-semibold text-gray-600">{o.name}</th>
              ))}
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Total</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Nilai</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={outlets.length + 3} className="px-3 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={outlets.length + 3} className="px-3 py-6 text-center text-gray-400">Tidak ada produk</td></tr>
            ) : (
              shown.map((p) => (
                <tr key={p.product_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-900">{p.name}<span className="block text-xs text-gray-400">{p.sku}</span></td>
                  {outlets.map((o) => {
                    const s = qtyAt(p, o.id)
                    const low = s && s.quantity <= s.reorder_level
                    return (
                      <td key={o.id} className={`px-3 py-2 text-right ${low ? 'font-semibold text-red-600' : 'text-gray-700'}`}>
                        {s ? s.quantity : '-'}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-right font-medium text-gray-900">{p.total_quantity}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(p.total_value)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
