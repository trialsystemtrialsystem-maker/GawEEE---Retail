'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { DateRangePicker, defaultDateRange, type DateRange } from '@/components/ui/DateRangePicker'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { computeRatios, formatRatio } from '@/lib/utils/financialRatios'
import { useResolvedOutlet } from '@/lib/hooks/useResolvedOutlet'

interface Row {
  account_code: string
  balance: number
}
interface BalanceSheet {
  asset: Row[]
  totalAsset: number
  totalLiability: number
  totalEquity: number
}
interface ProfitLoss {
  income: Row[]
  expense: Row[]
  totalIncome: number
  netProfit: number
}

export function FinancialRatiosView() {
  const { outletId, isResolving, selectedOutlet, setSelectedOutlet } = useResolvedOutlet()
  const [range, setRange] = useState<DateRange>(() => defaultDateRange(30))
  const [data, setData] = useState<{ bs: BalanceSheet; pl: ProfitLoss } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!outletId) return
    setError(null)
    const [bs, pl] = await Promise.all([
      fetch(`/api/accounting/reports?type=balance-sheet&outlet_id=${outletId}&as_of=${range.end}`),
      fetch(`/api/accounting/reports?type=profit-loss&outlet_id=${outletId}&start=${range.start}&end=${range.end}`),
    ])
    if (!bs.ok || !pl.ok) {
      setError('Gagal memuat laporan')
      return
    }
    setData({ bs: await bs.json(), pl: await pl.json() })
  }, [outletId, range])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  if (isResolving) return <p className="text-sm text-gray-400">Memuat…</p>

  const ratios = data
    ? computeRatios({
        // Current assets = kas, bank, piutang, persediaan (codes below 1500, the fixed-asset block).
        currentAssets: data.bs.asset.filter((a) => Number(a.account_code) < 1500).reduce((s, a) => s + a.balance, 0),
        inventory: data.bs.asset.filter((a) => a.account_code === '1200').reduce((s, a) => s + a.balance, 0),
        totalLiability: data.bs.totalLiability,
        totalEquity: data.bs.totalEquity,
        totalAsset: data.bs.totalAsset,
        revenue: data.pl.totalIncome,
        cogs: data.pl.expense.filter((a) => a.account_code === '5000').reduce((s, a) => s + a.balance, 0),
        operatingExpense: data.pl.expense.filter((a) => a.account_code !== '5000').reduce((s, a) => s + a.balance, 0),
        netProfit: data.pl.netProfit,
      })
    : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <OutletSelector includeAll={false} value={selectedOutlet} onChange={setSelectedOutlet} />
        <DateRangePicker value={range} onChange={setRange} />
        <ExportCsvButton filename="rasio-keuangan" rows={ratios.map((r) => ({ Rasio: r.label, Nilai: formatRatio(r), Arti: r.hint }))} />
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ratios.map((r) => (
          <Card key={r.key}>
            <p className="text-sm text-gray-500">{r.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{formatRatio(r)}</p>
            <p className="mt-1 text-xs text-gray-400">{r.hint}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
