'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'

interface ExpenseRequest {
  id: string
  description: string
  amount: number
  requested_by_name: string
  paid_at: string | null
  payment_method: string | null
}

// Reads the same expense_requests entries FinanceApprovals.tsx manages,
// filtered to ones actually marked paid — a running ledger of petty cash
// disbursed, rather than a separate system. See Phase 11 plan item 12.
export function PettyCashReport({ outletId }: { outletId: string }) {
  const [requests, setRequests] = useState<ExpenseRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/expense-requests?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setRequests((data.requests ?? []).filter((r: ExpenseRequest) => r.paid_at))
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  const total = requests.reduce((sum, r) => sum + r.amount, 0)
  const csvRows = requests.map((r) => ({
    tanggal: r.paid_at,
    deskripsi: r.description,
    diajukan_oleh: r.requested_by_name,
    metode: r.payment_method,
    nominal: r.amount,
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Total Kas Keluar: <span className="text-lg font-bold text-gray-900">{formatCurrency(total)}</span>
        </p>
        <ExportCsvButton filename="kas-kecil" rows={csvRows} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal Dibayar</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Deskripsi</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Diajukan Oleh</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Metode</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Nominal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada pengeluaran yang dibayar</td></tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600">{r.paid_at ? formatDateTime(r.paid_at) : '-'}</td>
                  <td className="px-4 py-2 text-gray-900">{r.description}</td>
                  <td className="px-4 py-2 text-gray-600">{r.requested_by_name}</td>
                  <td className="px-4 py-2 capitalize text-gray-600">{r.payment_method?.replace('_', ' ') ?? '-'}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(r.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
