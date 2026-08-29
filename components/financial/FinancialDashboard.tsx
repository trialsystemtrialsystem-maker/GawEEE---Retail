'use client'

import { useEffect, useState } from 'react'
import { KPICard } from '@/components/dashboard/KPICard'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatPercent } from '@/lib/utils/formatting'

interface DailySummary {
  sales: { total_sales: number; cash: number; e_wallet: number; bank_transfer: number; total_discount: number; tax_collected: number }
  inventory: { cost_of_goods_sold: number; gross_profit: number; gross_profit_margin: number }
  cash_position: { opening_cash: number; cash_received: number; closing_cash: number }
  operations: { transaction_count: number; items_sold: number; avg_transaction_value: number }
  alerts: { type: string; severity: string; message: string }[]
}

export function FinancialDashboard() {
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/reports/daily-summary')
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Gagal memuat laporan')
          return
        }
        setSummary(data)
      })
      .catch(() => setError('Terjadi kesalahan jaringan'))
  }, [])

  if (error) return <Alert variant="danger">{error}</Alert>
  if (!summary) return <p className="text-gray-400">Memuat…</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Penjualan Hari Ini" value={formatCurrency(summary.sales.total_sales)} />
        <KPICard
          label="Keuntungan Kotor"
          value={formatCurrency(summary.inventory.gross_profit)}
          change={formatPercent(summary.inventory.gross_profit_margin / 100)}
          tone="positive"
        />
        <KPICard label="Kas di Tangan" value={formatCurrency(summary.cash_position.closing_cash)} />
        <KPICard label="Transaksi" value={String(summary.operations.transaction_count)} />
      </div>

      {summary.alerts.length > 0 && (
        <div className="space-y-2">
          {summary.alerts.map((alert, i) => (
            <Alert key={i} variant={alert.severity === 'critical' ? 'danger' : 'warning'}>
              {alert.message}
            </Alert>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Rincian Penjualan</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Tunai</dt>
              <dd className="text-gray-900">{formatCurrency(summary.sales.cash)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">E-Wallet</dt>
              <dd className="text-gray-900">{formatCurrency(summary.sales.e_wallet)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Transfer Bank</dt>
              <dd className="text-gray-900">{formatCurrency(summary.sales.bank_transfer)}</dd>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <dt className="text-gray-500">Diskon</dt>
              <dd className="text-gray-900">{formatCurrency(summary.sales.total_discount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">PPN Terkumpul</dt>
              <dd className="text-gray-900">{formatCurrency(summary.sales.tax_collected)}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Posisi Kas</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Kas Awal</dt>
              <dd className="text-gray-900">{formatCurrency(summary.cash_position.opening_cash)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Kas Diterima</dt>
              <dd className="text-gray-900">{formatCurrency(summary.cash_position.cash_received)}</dd>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 font-semibold">
              <dt className="text-gray-900">Kas Akhir</dt>
              <dd className="text-gray-900">{formatCurrency(summary.cash_position.closing_cash)}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  )
}
