'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils/formatting'
import { PAYMENT_METHOD_LABELS } from '@/lib/utils/constants'
import { SalesByHourChart } from '@/components/charts/SalesByHourChart'
import { CategoryBreakdownChart } from '@/components/charts/CategoryBreakdownChart'

interface Report {
  date: string
  total_sales: number
  transaction_count: number
  avg_transaction: number
  voided_count: number
  sales_by_hour: { hour: string; total: number }[]
  payment_breakdown: { method: string; total: number }[]
}

export function MyDailyReport() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [report, setReport] = useState<Report | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/pos/my-daily-report?date=${date}`)
    const data = await res.json()
    if (res.ok) setReport(data)
    setIsLoading(false)
  }, [date])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  return (
    <div className="space-y-4">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        max={new Date().toISOString().slice(0, 10)}
        className="rounded-lg border-2 border-[var(--brand-100)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
      />

      {isLoading || !report ? (
        <p className="py-8 text-center text-sm text-gray-400">Memuat…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-gradient-to-br from-[var(--brand-700)] to-[var(--brand-500)] p-4 text-white shadow-lg">
              <p className="text-xs text-white/80">Total Penjualan</p>
              <p className="text-2xl font-extrabold">{formatCurrency(report.total_sales)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--brand-100)] bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">Jumlah Transaksi</p>
              <p className="text-2xl font-extrabold text-[var(--brand-900)]">{report.transaction_count}</p>
            </div>
            <div className="rounded-2xl border border-[var(--brand-100)] bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">Rata-rata / Transaksi</p>
              <p className="text-2xl font-extrabold text-[var(--brand-900)]">{formatCurrency(report.avg_transaction)}</p>
            </div>
          </div>

          {report.voided_count > 0 && (
            <p className="text-sm text-[var(--color-danger)]">⚠️ {report.voided_count} transaksi dibatalkan hari ini (tidak dihitung di atas)</p>
          )}

          <div className="rounded-2xl border border-[var(--brand-100)] bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-[var(--brand-700)]">Penjualan per Jam</h3>
            {report.sales_by_hour.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">Belum ada transaksi pada tanggal ini</p>
            ) : (
              <SalesByHourChart data={report.sales_by_hour} />
            )}
          </div>

          <div className="rounded-2xl border border-[var(--brand-100)] bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-[var(--brand-700)]">Metode Pembayaran</h3>
            {report.payment_breakdown.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">Belum ada pembayaran pada tanggal ini</p>
            ) : (
              <CategoryBreakdownChart
                data={report.payment_breakdown.map((p) => ({ name: PAYMENT_METHOD_LABELS[p.method] ?? p.method, revenue: p.total }))}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
