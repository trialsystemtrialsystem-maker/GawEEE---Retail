'use client'

import { useEffect, useState } from 'react'
import { KPICard } from '@/components/dashboard/KPICard'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency } from '@/lib/utils/formatting'

interface DailySummary {
  sales: { total_sales: number }
  inventory: { gross_profit: number }
  operations: { transaction_count: number }
  alerts: { type: string; severity: string; message: string }[]
}

// Was reading the daily_financial_summary table (populated by nothing —
// nightly-job material, see todo.md), so the overview always showed zeros
// regardless of actual sales. Uses the live-computed report endpoint instead,
// the same one the financial dashboard and POS already rely on.
export function TodayOverview({ lowStockCount }: { lowStockCount: number }) {
  const [data, setData] = useState<DailySummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/reports/daily-summary')
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? 'Gagal memuat ringkasan')
          return
        }
        setData(json)
      })
      .catch(() => setError('Terjadi kesalahan jaringan'))
  }, [])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Penjualan Hari Ini" value={formatCurrency(data?.sales.total_sales ?? 0)} />
        <KPICard
          label="Keuntungan"
          value={formatCurrency(data?.inventory.gross_profit ?? 0)}
          tone={data && data.inventory.gross_profit > 0 ? 'positive' : 'neutral'}
        />
        <KPICard label="Transaksi" value={String(data?.operations.transaction_count ?? 0)} />
        <KPICard label="Stok Rendah" value={String(lowStockCount)} tone={lowStockCount > 0 ? 'negative' : 'neutral'} />
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {data && data.operations.transaction_count === 0 && (
        <Alert variant="info">
          Belum ada transaksi untuk hari ini. Data akan muncul otomatis setelah transaksi pertama
          dibuat lewat POS — atau klik &quot;Coba Demo&quot; di landing page untuk melihat dashboard
          terisi penuh.
        </Alert>
      )}
    </div>
  )
}
