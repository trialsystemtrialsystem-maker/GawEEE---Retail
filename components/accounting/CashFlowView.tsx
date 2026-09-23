'use client'

import { useEffect, useState, useCallback } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { DateRangePicker, defaultDateRange, type DateRange } from '@/components/ui/DateRangePicker'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { formatCurrency } from '@/lib/utils/formatting'
import { useResolvedOutlet } from '@/lib/hooks/useResolvedOutlet'

interface ActivityRow {
  source_type: string
  amount: number
}

interface CashFlowData {
  period: { start: string; end: string }
  opening_balance: number
  closing_balance: number
  net_change: number
  by_activity: ActivityRow[]
}

const SOURCE_LABEL: Record<string, string> = {
  sales: 'Penjualan',
  purchase: 'Penerimaan Barang (PO)',
  purchase_payment: 'Pelunasan Hutang Supplier',
  expense_request: 'Pengeluaran (Kas Kecil)',
  void: 'Pembatalan Transaksi',
  manual: 'Jurnal Manual',
}

export function CashFlowView({ outletId: outletIdProp }: { outletId?: string }) {
  const { outletId, isResolving, selectedOutlet, setSelectedOutlet } = useResolvedOutlet(outletIdProp)
  const [range, setRange] = useState<DateRange>(() => defaultDateRange(30))
  const [data, setData] = useState<CashFlowData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!outletId) return
    setIsLoading(true)
    const res = await fetch(`/api/accounting/reports?outlet_id=${outletId}&type=cash-flow&start=${range.start}&end=${range.end}`)
    const json = await res.json()
    if (res.ok) setData(json)
    setIsLoading(false)
  }, [outletId, range])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  if (isResolving) return <p className="text-sm text-gray-400">Memuat…</p>

  const csvRows = (data?.by_activity ?? []).map((r) => ({
    jenis_transaksi: SOURCE_LABEL[r.source_type] ?? r.source_type,
    jumlah: r.amount,
  }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {!outletIdProp && <OutletSelector includeAll={false} value={selectedOutlet} onChange={setSelectedOutlet} />}
          <DateRangePicker value={range} onChange={setRange} />
        </div>
        <ExportCsvButton filename="arus-kas" rows={csvRows} />
      </div>

      <Alert variant="info">
        Metode langsung, dikelompokkan berdasarkan jenis transaksi (bukan klasifikasi Operasi/Investasi/Pendanaan
        formal) — mencakup pergerakan akun Kas dan Bank saja.
      </Alert>

      {isLoading || !data ? (
        <p className="text-sm text-gray-400">Memuat…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-sm text-gray-500">Saldo Awal</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(data.opening_balance)}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Perubahan Bersih</p>
              <p className={`mt-1 text-xl font-bold ${data.net_change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {data.net_change >= 0 ? '+' : ''}
                {formatCurrency(data.net_change)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Saldo Akhir</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(data.closing_balance)}</p>
            </Card>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Jenis Transaksi</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {data.by_activity.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-gray-400">Tidak ada pergerakan kas pada periode ini</td>
                  </tr>
                ) : (
                  data.by_activity.map((r) => (
                    <tr key={r.source_type} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900">{SOURCE_LABEL[r.source_type] ?? r.source_type}</td>
                      <td className={`px-4 py-2 text-right font-medium ${r.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {r.amount >= 0 ? '+' : ''}
                        {formatCurrency(r.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
