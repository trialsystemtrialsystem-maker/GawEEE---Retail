'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency } from '@/lib/utils/formatting'

interface Customer {
  name: string
  phone: string
  recency_days: number
  frequency: number
  monetary: number
  r_score: number
  f_score: number
  m_score: number
  segment: string
  segment_label: string
  segment_action: string
}
interface SegmentRow {
  segment: string
  label: string
  action: string
  customer_count: number
  total_monetary: number
}

const SEGMENT_COLORS: Record<string, string> = {
  champions: 'var(--status-good)',
  loyal: 'var(--brand-500)',
  potential: 'var(--chart-3)',
  new: 'var(--chart-2)',
  at_risk: 'var(--status-warning)',
  cant_lose: 'var(--status-critical)',
  hibernating: 'var(--chart-muted)',
  attention: 'var(--chart-4)',
}

export function CustomerSegmentationReport({ outletId }: { outletId: string }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [bySegment, setBySegment] = useState<SegmentRow[]>([])
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/reports/customer-segmentation')
    const data = await res.json()
    if (res.ok) {
      setCustomers(data.customers ?? [])
      setBySegment(data.bySegment ?? [])
      setNote(data.note ?? '')
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load, outletId])

  const chartData = bySegment.filter((s) => s.customer_count > 0)
  const visibleCustomers = filter ? customers.filter((c) => c.segment === filter) : customers

  return (
    <div className="space-y-4">
      {note && <Alert variant="info">{note}</Alert>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Pelanggan Tersegmentasi</p>
          <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Pelanggan Utama</p>
          <p className="text-2xl font-bold" style={{ color: SEGMENT_COLORS.champions }}>
            {bySegment.find((s) => s.segment === 'champions')?.customer_count ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Berisiko</p>
          <p className="text-2xl font-bold" style={{ color: SEGMENT_COLORS.at_risk }}>
            {bySegment.find((s) => s.segment === 'at_risk')?.customer_count ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Jangan Sampai Hilang</p>
          <p className="text-2xl font-bold" style={{ color: SEGMENT_COLORS.cant_lose }}>
            {bySegment.find((s) => s.segment === 'cant_lose')?.customer_count ?? 0}
          </p>
        </div>
      </div>

      {!isLoading && chartData.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Distribusi Segmen Pelanggan</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: 'var(--chart-muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--chart-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value, name) => (name === 'customer_count' ? [value, 'Jumlah Pelanggan'] : [formatCurrency(Number(value)), 'Total Belanja'])}
                  contentStyle={{ background: 'var(--chart-surface)', border: '1px solid var(--chart-grid)', borderRadius: 8, fontSize: 13 }}
                />
                <Bar dataKey="customer_count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {chartData.map((s) => (
                    <Cell key={s.segment} fill={SEGMENT_COLORS[s.segment] ?? 'var(--chart-1)'} cursor="pointer" onClick={() => setFilter(filter === s.segment ? null : s.segment)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilter(null)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${!filter ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]' : 'border-gray-200 text-gray-600'}`}
        >
          Semua
        </button>
        {bySegment.filter((s) => s.customer_count > 0).map((s) => (
          <button
            key={s.segment}
            type="button"
            onClick={() => setFilter(filter === s.segment ? null : s.segment)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${filter === s.segment ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]' : 'border-gray-200 text-gray-600'}`}
          >
            {s.label} ({s.customer_count})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Pelanggan</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Segmen</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Terakhir Belanja</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Frekuensi</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Total Belanja</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">R-F-M</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Rekomendasi Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : visibleCustomers.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Belum ada pelanggan dengan riwayat transaksi</td></tr>
            ) : (
              visibleCustomers.map((c) => (
                <tr key={c.phone} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {c.name} <span className="font-normal text-gray-400">— {c.phone}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: `color-mix(in srgb, ${SEGMENT_COLORS[c.segment] ?? 'var(--chart-1)'} 15%, white)`, color: SEGMENT_COLORS[c.segment] ?? 'var(--chart-1)' }}
                    >
                      {c.segment_label}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">{c.recency_days} hari lalu</td>
                  <td className="px-4 py-2 text-right text-gray-700">{c.frequency}x</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(c.monetary)}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{c.r_score}-{c.f_score}-{c.m_score}</td>
                  <td className="px-4 py-2 text-xs text-gray-600">{c.segment_action}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
