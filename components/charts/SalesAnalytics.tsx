'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { SalesTrendChart } from '@/components/charts/SalesTrendChart'
import { CategoryBreakdownChart } from '@/components/charts/CategoryBreakdownChart'
import { ComparisonKPIRow } from '@/components/charts/ComparisonKPIRow'

interface TrendResponse {
  daily: { date: string; total_sales: number; transaction_count: number; gross_profit: number }[]
  comparison: {
    current: { revenue: number; transactions: number; profit: number }
    previous: { revenue: number; transactions: number; profit: number }
    change_percent: { revenue: number; transactions: number; profit: number }
  }
  category_breakdown: { name: string; revenue: number }[]
}

const RANGE_OPTIONS = [
  { label: '30 Hari', days: 30 },
  { label: '90 Hari', days: 90 },
]

export function SalesAnalytics() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<TrendResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/reports/sales-trend?days=${days}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Gagal memuat data tren')
        return
      }
      setData(json)
    } catch {
      setError('Terjadi kesalahan jaringan')
    }
  }, [days])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  if (error) return <Alert variant="danger">{error}</Alert>
  if (!data) return <p className="text-gray-400">Memuat analitik…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Perbandingan Periode</h2>
        <div className="flex gap-1 rounded-md border border-gray-200 p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              onClick={() => setDays(opt.days)}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                days === opt.days ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <ComparisonKPIRow data={data.comparison} periodLabel={`${days} hari`} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-2 text-base font-semibold text-gray-900">Tren Penjualan &amp; Laba</h3>
          <SalesTrendChart data={data.daily} />
        </Card>
        <Card>
          <h3 className="mb-2 text-base font-semibold text-gray-900">Pendapatan per Kategori</h3>
          {data.category_breakdown.length > 0 ? (
            <CategoryBreakdownChart data={data.category_breakdown} />
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">Belum ada data kategori</p>
          )}
        </Card>
      </div>
    </div>
  )
}
