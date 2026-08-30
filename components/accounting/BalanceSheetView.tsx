'use client'

import { useEffect, useState, useCallback } from 'react'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency } from '@/lib/utils/formatting'

interface AccountBalance {
  id: string
  account_code: string
  account_name: string
  balance: number
}

interface BalanceSheetData {
  asset: AccountBalance[]
  liability: AccountBalance[]
  equity: AccountBalance[]
  totalAsset: number
  totalLiability: number
  totalEquity: number
  isBalanced: boolean
}

function Section({ title, rows, total }: { title: string; rows: AccountBalance[]; total: number }) {
  return (
    <div className="rounded-lg border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 font-semibold text-gray-700">{title}</div>
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-3 text-center text-gray-400">Tidak ada saldo</td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 text-gray-700">{r.account_name}</td>
                <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(r.balance)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot className="bg-gray-50">
          <tr>
            <td className="px-4 py-2 font-semibold text-gray-700">Total {title}</td>
            <td className="px-4 py-2 text-right font-bold text-gray-900">{formatCurrency(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function BalanceSheetView({ outletId }: { outletId: string }) {
  const [data, setData] = useState<BalanceSheetData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/accounting/reports?outlet_id=${outletId}&type=balance-sheet`)
    const json = await res.json()
    if (res.ok) setData(json)
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  if (isLoading) return <p className="text-sm text-gray-400">Memuat…</p>
  if (!data) return <Alert variant="danger">Gagal memuat neraca</Alert>

  return (
    <div className="space-y-4">
      {!data.isBalanced && (
        <Alert variant="warning">
          Aset ({formatCurrency(data.totalAsset)}) belum sama dengan Liabilitas + Ekuitas (
          {formatCurrency(data.totalLiability + data.totalEquity)}) — pastikan laba/rugi berjalan sudah dijurnal ke
          akun Laba Ditahan.
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Aset" rows={data.asset} total={data.totalAsset} />
        <div className="space-y-4">
          <Section title="Liabilitas" rows={data.liability} total={data.totalLiability} />
          <Section title="Ekuitas" rows={data.equity} total={data.totalEquity} />
        </div>
      </div>
    </div>
  )
}
