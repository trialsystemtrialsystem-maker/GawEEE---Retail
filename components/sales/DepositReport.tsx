'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'
import { PaymentMethodDonutChart } from '@/components/charts/PaymentMethodDonutChart'
import { DateRangePicker, defaultDateRange, type DateRange } from '@/components/ui/DateRangePicker'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'

interface Deposit {
  id: string
  customer_name: string
  quantity: number
  deposit_amount: number
  total_price: number
  status: 'pending' | 'fulfilled' | 'cancelled'
  created_at: string
  products: { name: string } | null
}
interface Summary {
  byStatus: { pending: number; fulfilled: number; cancelled: number }
  totalDeposited: number
  totalOutstanding: number
}

const STATUS_LABELS: Record<Deposit['status'], string> = { pending: 'Menunggu', fulfilled: 'Selesai', cancelled: 'Dibatalkan' }

export function DepositReport({ outletId }: { outletId?: string } = {}) {
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [range, setRange] = useState<DateRange>(() => defaultDateRange(365))
  const [selectedOutlet, setSelectedOutlet] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const effectiveOutlet = outletId ?? selectedOutlet

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/reports/deposit?outlet_id=${effectiveOutlet}&start=${range.start}&end=${range.end}`)
    const data = await res.json()
    if (res.ok) {
      setDeposits(data.deposits ?? [])
      setSummary(data.summary ?? null)
    }
    setIsLoading(false)
  }, [effectiveOutlet, range])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const statusChartData = summary
    ? [
        { name: 'Menunggu', value: summary.byStatus.pending },
        { name: 'Selesai', value: summary.byStatus.fulfilled },
        { name: 'Dibatalkan', value: summary.byStatus.cancelled },
      ].filter((d) => d.value > 0)
    : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {!outletId && <OutletSelector value={selectedOutlet} onChange={setSelectedOutlet} />}
          <DateRangePicker value={range} onChange={setRange} />
        </div>
        <ExportCsvButton filename="deposit-report" rows={deposits} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Deposit Diterima</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary?.totalDeposited ?? 0)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Sisa Tagihan (Belum Diambil)</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary?.totalOutstanding ?? 0)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Deposit</p>
          <p className="text-2xl font-bold text-gray-900">{deposits.length}</p>
        </div>
      </div>

      {!isLoading && statusChartData.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Status Deposit</h3>
          <PaymentMethodDonutChart data={statusChartData} />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Pelanggan</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Deposit</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Total</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : deposits.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Belum ada deposit tercatat</td></tr>
            ) : (
              deposits.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{d.customer_name}</td>
                  <td className="px-4 py-2 text-gray-600">{d.products?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(d.deposit_amount)}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(d.total_price)}</td>
                  <td className="px-4 py-2 text-gray-600">{STATUS_LABELS[d.status]}</td>
                  <td className="px-4 py-2 text-gray-600">{formatDateTime(d.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
