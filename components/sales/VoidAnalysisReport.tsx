'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'

interface Summary {
  total_invoices: number
  voided_count: number
  voided_value: number
  void_rate_pct: number
}
interface CashierRow {
  cashier_id: string
  cashier_name: string
  total_sales: number
  voided_count: number
  voided_value: number
  void_rate_pct: number
}
interface ReasonRow {
  reason: string
  count: number
}
interface DayRow {
  day: string
  count: number
}

export function VoidAnalysisReport({ outletId }: { outletId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [byCashier, setByCashier] = useState<CashierRow[]>([])
  const [byReason, setByReason] = useState<ReasonRow[]>([])
  const [byDay, setByDay] = useState<DayRow[]>([])
  const [days, setDays] = useState(30)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/reports/void-analysis?days=${days}`)
    const data = await res.json()
    if (res.ok) {
      setSummary(data.summary ?? null)
      setByCashier(data.byCashier ?? [])
      setByReason(data.byReason ?? [])
      setByDay(data.byDay ?? [])
    }
    setIsLoading(false)
  }, [days])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load, outletId])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Periode:</label>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-sm border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]">
          <option value={7}>7 hari terakhir</option>
          <option value={30}>30 hari terakhir</option>
          <option value={90}>90 hari terakhir</option>
        </select>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Transaksi</p>
            <p className="text-2xl font-bold text-gray-900">{summary.total_invoices}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Dibatalkan</p>
            <p className="text-2xl font-bold text-red-600">{summary.voided_count}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Nilai Dibatalkan</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.voided_value)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Tingkat Pembatalan</p>
            <p className={`text-2xl font-bold ${summary.void_rate_pct >= 5 ? 'text-red-600' : summary.void_rate_pct >= 2 ? 'text-amber-600' : 'text-gray-900'}`}>
              {summary.void_rate_pct.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {!isLoading && byDay.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Tren Pembatalan Harian</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fill: 'var(--chart-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatDate(v)} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--chart-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={(v) => formatDate(String(v))} contentStyle={{ background: 'var(--chart-surface)', border: '1px solid var(--chart-grid)', borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="count" name="Dibatalkan" fill="var(--status-critical)" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Per Kasir (transaksi asal)</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Kasir</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Total Transaksi</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Dibatalkan</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Nilai Dibatalkan</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Tingkat Pembatalan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
              ) : byCashier.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Tidak ada pembatalan pada periode ini</td></tr>
              ) : (
                byCashier.map((c) => (
                  <tr key={c.cashier_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{c.cashier_name}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{c.total_sales}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{c.voided_count}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(c.voided_value)}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.void_rate_pct >= 5 ? 'bg-red-50 text-red-700' : c.void_rate_pct >= 2 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                        {c.void_rate_pct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Alasan Pembatalan Terbanyak</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Alasan</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
              ) : byReason.length === 0 ? (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-400">Tidak ada pembatalan pada periode ini</td></tr>
              ) : (
                byReason.map((r) => (
                  <tr key={r.reason} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{r.reason}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{r.count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
