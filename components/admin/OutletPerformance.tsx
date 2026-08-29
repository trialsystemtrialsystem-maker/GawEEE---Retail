'use client'

import { useEffect, useState } from 'react'
import { KPICard } from '@/components/dashboard/KPICard'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatPercent } from '@/lib/utils/formatting'

interface OutletRow {
  outlet_id: string
  outlet_name: string
  revenue_mtd: number
  profit_margin_percent: number
  transaction_count: number
  staff_count: number
  status: string
}

interface OutletsResponse {
  total_outlets: number
  outlets: OutletRow[]
  company_totals: {
    total_revenue_mtd: number
    total_profit_margin: number
    total_transactions: number
    total_staff: number
  }
}

export function OutletPerformance() {
  const [data, setData] = useState<OutletsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/outlets')
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? 'Gagal memuat data')
          return
        }
        setData(json)
      })
      .catch(() => setError('Terjadi kesalahan jaringan'))
  }, [])

  if (error) return <Alert variant="danger">{error}</Alert>
  if (!data) return <p className="text-gray-400">Memuat…</p>

  const sorted = [...data.outlets].sort((a, b) => b.revenue_mtd - a.revenue_mtd)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Total Revenue (MTD)" value={formatCurrency(data.company_totals.total_revenue_mtd)} />
        <KPICard label="Outlet Aktif" value={`${data.total_outlets}`} />
        <KPICard label="Total Transaksi" value={String(data.company_totals.total_transactions)} />
        <KPICard label="Rata-rata Margin" value={formatPercent(data.company_totals.total_profit_margin / 100)} />
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Outlet Performance Leaderboard</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">Outlet</th>
                <th className="py-2 pr-4 text-right">Revenue MTD</th>
                <th className="py-2 pr-4 text-right">Margin</th>
                <th className="py-2 pr-4 text-right">Transaksi</th>
                <th className="py-2 pr-4 text-right">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((outlet, i) => (
                <tr key={outlet.outlet_id}>
                  <td className="py-2 pr-4 text-gray-400">{i + 1}</td>
                  <td className="py-2 pr-4 font-medium text-gray-900">{outlet.outlet_name}</td>
                  <td className="py-2 pr-4 text-right text-gray-700">{formatCurrency(outlet.revenue_mtd)}</td>
                  <td className="py-2 pr-4 text-right text-gray-700">{formatPercent(outlet.profit_margin_percent / 100)}</td>
                  <td className="py-2 pr-4 text-right text-gray-700">{outlet.transaction_count}</td>
                  <td className="py-2 pr-4 text-right text-gray-700">{outlet.staff_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
