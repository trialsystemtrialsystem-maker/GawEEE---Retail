'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatPercent } from '@/lib/utils/formatting'

interface PnLData {
  period: { from_date: string; to_date: string }
  revenue: number
  cost_of_goods_sold: number
  gross_profit: number
  gross_profit_margin: number
  operating_expenses: { total: number }
  operating_profit: number
  net_profit: number
  net_profit_margin: number
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
function firstOfMonth() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

export function ProfitLossReport() {
  const [fromDate, setFromDate] = useState(firstOfMonth())
  const [toDate, setToDate] = useState(today())
  const [data, setData] = useState<PnLData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports/p-and-l?from_date=${fromDate}&to_date=${toDate}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Gagal memuat laporan')
        return
      }
      setData(json)
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setIsLoading(false)
    }
  }, [fromDate, toDate])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input label="Dari Tanggal" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <Input label="Sampai Tanggal" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {isLoading || !data ? (
        <p className="text-gray-400">Memuat…</p>
      ) : (
        <Card className="max-w-lg space-y-2 text-sm">
          <Row label="Pendapatan" value={formatCurrency(data.revenue)} />
          <Row label="HPP (COGS)" value={formatCurrency(data.cost_of_goods_sold)} />
          <Row label="Laba Kotor" value={formatCurrency(data.gross_profit)} bold />
          <Row label="Margin Kotor" value={formatPercent(data.gross_profit_margin / 100)} />
          <Row label="Biaya Operasional" value={formatCurrency(data.operating_expenses.total)} />
          <Row label="Laba Operasional" value={formatCurrency(data.operating_profit)} />
          <div className="border-t border-gray-200 pt-2">
            <Row label="Laba Bersih" value={formatCurrency(data.net_profit)} bold />
            <Row label="Margin Bersih" value={formatPercent(data.net_profit_margin / 100)} />
          </div>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
