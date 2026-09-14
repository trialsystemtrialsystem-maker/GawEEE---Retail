'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'

interface ReconciliationRow {
  id: string
  invoice_number: string
  invoice_date: string
  supplier_name: string
  total: number
  returned: number
  net_payable: number
  paid: number
  remaining: number
}

export function PurchaseReturnReconciliation() {
  const [rows, setRows] = useState<ReconciliationRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/reports/purchase-return-reconciliation')
    const data = await res.json()
    if (res.ok) setRows(data.invoices ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const withReturns = rows.filter((r) => r.returned > 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Invoice dengan Retur</p>
          <p className="text-2xl font-bold text-gray-900">{withReturns.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Nilai Retur</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(withReturns.reduce((s, r) => s + r.returned, 0))}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Sisa Tagihan Setelah Retur</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(rows.reduce((s, r) => s + r.remaining, 0))}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">No. Invoice</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Supplier</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Total Invoice</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Retur</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Wajib Bayar</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Sudah Dibayar</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Sisa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Belum ada invoice pembelian</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className={`hover:bg-gray-50 ${r.returned > 0 ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {r.invoice_number}
                    <p className="text-xs font-normal text-gray-400">{formatDate(r.invoice_date)}</p>
                  </td>
                  <td className="px-4 py-2 text-gray-700">{r.supplier_name}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(r.total)}</td>
                  <td className="px-4 py-2 text-right text-red-600">{r.returned > 0 ? `-${formatCurrency(r.returned)}` : '-'}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(r.net_payable)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(r.paid)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${r.remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatCurrency(r.remaining)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
