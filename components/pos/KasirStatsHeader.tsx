'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils/formatting'
import { PAYMENT_METHOD_LABELS } from '@/lib/utils/constants'
import { SalesByHourChart } from '@/components/charts/SalesByHourChart'
import { PaymentMethodDonutChart } from '@/components/charts/PaymentMethodDonutChart'

interface Report {
  total_sales: number
  transaction_count: number
  avg_transaction: number
  pending_count: number
  sales_by_hour: { hour: string; total: number }[]
  payment_breakdown: { method: string; total: number }[]
}

// Today-at-a-glance strip shown right on the Kasir screen (matching the
// user-provided mockup), separate from the more detailed date-pickable
// /pos/laporan page — both read the same /api/pos/my-daily-report.
export function KasirStatsHeader() {
  const [report, setReport] = useState<Report | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/pos/my-daily-report')
    const data = await res.json()
    if (res.ok) setReport(data)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  if (!report) return null

  const cards = [
    { label: 'Omzet Hari Ini', value: formatCurrency(report.total_sales), color: 'emerald', icon: '📈' },
    { label: 'Transaksi', value: String(report.transaction_count), color: 'blue', icon: '🧾' },
    { label: 'Rata-rata/Transaksi', value: formatCurrency(report.avg_transaction), color: 'amber', icon: '💰' },
    { label: 'Menunggu Pembayaran', value: String(report.pending_count), color: 'red', icon: '⏳' },
  ] as const

  const colorClasses: Record<string, { border: string; text: string }> = {
    emerald: { border: 'border-t-emerald-500', text: 'text-emerald-700' },
    blue: { border: 'border-t-blue-500', text: 'text-blue-700' },
    amber: { border: 'border-t-amber-500', text: 'text-amber-700' },
    red: { border: 'border-t-red-500', text: 'text-red-700' },
  }

  return (
    <div className="mb-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border-t-4 bg-white p-3 shadow-sm ${colorClasses[c.color].border}`}>
            <p className={`text-xs font-medium ${colorClasses[c.color].text}`}>
              <span aria-hidden>{c.icon}</span> {c.label}
            </p>
            <p className="mt-1 text-xl font-extrabold text-gray-900">{c.value}</p>
          </div>
        ))}
      </div>

      {report.transaction_count > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold text-gray-700">Omzet per Jam</h3>
            <SalesByHourChart data={report.sales_by_hour} />
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold text-gray-700">Metode Bayar</h3>
            <PaymentMethodDonutChart data={report.payment_breakdown.map((p) => ({ name: PAYMENT_METHOD_LABELS[p.method] ?? p.method, value: p.total }))} />
          </div>
        </div>
      )}

      {report.pending_count > 0 && (
        <Link href="/pos/riwayat" className="inline-block text-xs font-medium text-red-600 hover:underline">
          Lihat {report.pending_count} transaksi menunggu pembayaran →
        </Link>
      )}
    </div>
  )
}
