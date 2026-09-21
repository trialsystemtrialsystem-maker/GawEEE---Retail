'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency } from '@/lib/utils/formatting'

interface MonthRow {
  month: string
  new_customer_count: number
  returning_customer_count: number
  new_revenue: number
  returning_revenue: number
}
interface Summary {
  total_new_customers: number
  total_returning_transactions: number
  returning_revenue_pct: number
}

export function NewVsReturningReport({ outletId }: { outletId: string }) {
  const [series, setSeries] = useState<MonthRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [note, setNote] = useState('')
  const [months, setMonths] = useState(6)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/reports/new-vs-returning?months=${months}`)
    const data = await res.json()
    if (res.ok) {
      setSeries(data.series ?? [])
      setSummary(data.summary ?? null)
      setNote(data.note ?? '')
    }
    setIsLoading(false)
  }, [months])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load, outletId])

  return (
    <div className="space-y-4">
      {note && <Alert variant="info">{note}</Alert>}

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Periode:</label>
        <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="rounded-sm border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]">
          <option value={3}>3 bulan terakhir</option>
          <option value={6}>6 bulan terakhir</option>
          <option value={12}>12 bulan terakhir</option>
        </select>
      </div>

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Pelanggan Baru</p>
            <p className="text-2xl font-bold text-gray-900">{summary.total_new_customers}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Transaksi Pelanggan Lama</p>
            <p className="text-2xl font-bold text-gray-900">{summary.total_returning_transactions}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">% Pendapatan dari Pelanggan Lama</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--status-good)' }}>{summary.returning_revenue_pct.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {!isLoading && series.length > 0 && (
        <>
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Jumlah Pelanggan per Bulan</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fill: 'var(--chart-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--chart-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--chart-surface)', border: '1px solid var(--chart-grid)', borderRadius: 8, fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="new_customer_count" name="Pelanggan Baru" stackId="c" fill="var(--chart-1)" radius={[0, 0, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="returning_customer_count" name="Pelanggan Lama" stackId="c" fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Pendapatan per Bulan</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fill: 'var(--chart-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--chart-muted)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ background: 'var(--chart-surface)', border: '1px solid var(--chart-grid)', borderRadius: 8, fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="new_revenue" name="Pendapatan Baru" stackId="r" fill="var(--chart-1)" radius={[0, 0, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="returning_revenue" name="Pendapatan Lama" stackId="r" fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Bulan</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Pelanggan Baru</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Pelanggan Lama</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Pendapatan Baru</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Pendapatan Lama</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : (
              series.map((m) => (
                <tr key={m.month} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{m.month}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{m.new_customer_count}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{m.returning_customer_count}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(m.new_revenue)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(m.returning_revenue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
