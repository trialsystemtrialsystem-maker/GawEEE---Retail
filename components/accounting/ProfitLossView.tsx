'use client'

import { useEffect, useState, useCallback } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils/formatting'

interface AccountBalance {
  id: string
  account_name: string
  balance: number
}

interface ProfitLossData {
  income: AccountBalance[]
  expense: AccountBalance[]
  totalIncome: number
  totalExpense: number
  netProfit: number
}

function firstDayOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export function ProfitLossView({ outletId }: { outletId: string }) {
  const [start, setStart] = useState(firstDayOfMonth)
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10))
  const [data, setData] = useState<ProfitLossData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/accounting/reports?outlet_id=${outletId}&type=profit-loss&start=${start}&end=${end}`)
    const json = await res.json()
    if (res.ok) setData(json)
    setIsLoading(false)
  }, [outletId, start, end])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Dari</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Sampai</label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Memuat…</p>
      ) : !data ? (
        <Alert variant="danger">Gagal memuat laporan laba rugi</Alert>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-sm text-gray-500">Total Pendapatan</p>
              <p className="mt-1 text-xl font-bold text-emerald-600">{formatCurrency(data.totalIncome)}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Total Beban</p>
              <p className="mt-1 text-xl font-bold text-red-600">{formatCurrency(data.totalExpense)}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">Laba Bersih</p>
              <p className={`mt-1 text-xl font-bold ${data.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(data.netProfit)}
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 font-semibold text-gray-700">Pendapatan</div>
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <tbody className="divide-y divide-gray-100 bg-white">
                  {data.income.length === 0 ? (
                    <tr>
                      <td className="px-4 py-3 text-center text-gray-400">Belum ada pendapatan</td>
                    </tr>
                  ) : (
                    data.income.map((a) => (
                      <tr key={a.id}>
                        <td className="px-4 py-2 text-gray-700">{a.account_name}</td>
                        <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(a.balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 font-semibold text-gray-700">Beban</div>
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <tbody className="divide-y divide-gray-100 bg-white">
                  {data.expense.length === 0 ? (
                    <tr>
                      <td className="px-4 py-3 text-center text-gray-400">Belum ada beban</td>
                    </tr>
                  ) : (
                    data.expense.map((a) => (
                      <tr key={a.id}>
                        <td className="px-4 py-2 text-gray-700">{a.account_name}</td>
                        <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(a.balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
