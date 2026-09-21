'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatCurrency } from '@/lib/utils/formatting'
import { DateRangePicker, defaultDateRange, type DateRange } from '@/components/ui/DateRangePicker'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'

interface Product {
  product_id: string
  name: string
  units_sold: number
  revenue: number
  profit: number
  revenue_pct: number
  cumulative_pct: number
  class: 'A' | 'B' | 'C'
}
interface SummaryRow {
  class: 'A' | 'B' | 'C'
  product_count: number
  revenue: number
  revenue_pct: number
}

const CLASS_COLORS: Record<string, string> = { A: 'var(--status-good)', B: 'var(--status-warning)', C: 'var(--chart-muted)' }
const CLASS_DESC: Record<string, string> = {
  A: 'Kontributor utama — jaga stok selalu tersedia, prioritas penempatan rak.',
  B: 'Kontributor menengah — pantau rutin, kandidat promosi untuk naik kelas.',
  C: 'Kontributor kecil (ekor panjang) — kurangi stok berlebih, evaluasi kelayakan jual.',
}

export function AbcAnalysisReport({ outletId }: { outletId?: string }) {
  const [products, setProducts] = useState<Product[]>([])
  const [summary, setSummary] = useState<SummaryRow[]>([])
  const [range, setRange] = useState<DateRange>(() => defaultDateRange(90))
  const [selectedOutlet, setSelectedOutlet] = useState('all')
  const [filter, setFilter] = useState<'A' | 'B' | 'C' | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const effectiveOutlet = outletId ?? selectedOutlet

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/reports/abc-analysis?outlet_id=${effectiveOutlet}&start=${range.start}&end=${range.end}`)
    const data = await res.json()
    if (res.ok) {
      setProducts(data.products ?? [])
      setSummary(data.summary ?? [])
    }
    setIsLoading(false)
  }, [effectiveOutlet, range])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const visibleProducts = filter ? products.filter((p) => p.class === filter) : products

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {!outletId && <OutletSelector value={selectedOutlet} onChange={setSelectedOutlet} />}
          <DateRangePicker value={range} onChange={setRange} />
        </div>
        <ExportCsvButton filename="abc-analysis" rows={products} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summary.map((s) => (
          <button
            key={s.class}
            type="button"
            onClick={() => setFilter(filter === s.class ? null : s.class)}
            className={`rounded-lg border p-4 text-left transition-colors ${filter === s.class ? 'border-[var(--brand-500)] bg-[var(--brand-50)]' : 'border-gray-200 hover:bg-gray-50'}`}
          >
            <p className="text-sm font-semibold" style={{ color: CLASS_COLORS[s.class] }}>Kelas {s.class}</p>
            <p className="text-2xl font-bold text-gray-900">{s.product_count} produk</p>
            <p className="text-sm text-gray-600">{formatCurrency(s.revenue)} ({s.revenue_pct.toFixed(1)}%)</p>
            <p className="mt-1 text-xs text-gray-500">{CLASS_DESC[s.class]}</p>
          </button>
        ))}
      </div>

      {!isLoading && products.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Kontribusi Pendapatan per Produk (20 Teratas)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={products.slice(0, 20)} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                <XAxis dataKey="name" tick={{ fill: 'var(--chart-muted)', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-35} textAnchor="end" height={80} />
                <YAxis tick={{ fill: 'var(--chart-muted)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ background: 'var(--chart-surface)', border: '1px solid var(--chart-grid)', borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="revenue" name="Pendapatan" radius={[4, 4, 0, 0]} maxBarSize={28}>
                  {products.slice(0, 20).map((p) => (
                    <Cell key={p.product_id} fill={CLASS_COLORS[p.class]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">#</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Kelas</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Unit Terjual</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Pendapatan</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Laba Kotor</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">% Pendapatan</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Kumulatif %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : visibleProducts.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Belum ada penjualan pada periode ini</td></tr>
            ) : (
              visibleProducts.map((p) => (
                <tr key={p.product_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-400">{products.indexOf(p) + 1}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{ backgroundColor: `color-mix(in srgb, ${CLASS_COLORS[p.class]} 15%, white)`, color: CLASS_COLORS[p.class] }}
                    >
                      {p.class}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">{p.units_sold}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(p.revenue)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(p.profit)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{p.revenue_pct.toFixed(1)}%</td>
                  <td className="px-4 py-2 text-right text-gray-500">{p.cumulative_pct.toFixed(1)}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
