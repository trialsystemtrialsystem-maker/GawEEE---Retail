'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils/formatting'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'

interface MonthRow {
  month: string
  taxable_sales: number
  tax_collected: number
  invoice_count: number
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function TaxReport({ outletId }: { outletId: string }) {
  const [rows, setRows] = useState<MonthRow[]>([])
  const [totals, setTotals] = useState({ totalTax: 0, totalTaxableSales: 0 })
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/reports/tax-report?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) {
      setRows(data.rows ?? [])
      setTotals({ totalTax: data.totalTax ?? 0, totalTaxableSales: data.totalTaxableSales ?? 0 })
    }
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportCsvButton filename="tax-report" rows={rows} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-gray-500">Total Penjualan Kena Pajak (tahun ini)</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(totals.totalTaxableSales)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Total PPN Terkumpul (tahun ini)</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">{formatCurrency(totals.totalTax)}</p>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Bulan</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Jumlah Invoice</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Penjualan Kena Pajak</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">PPN Terkumpul</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Belum ada transaksi tahun ini</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.month} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">
                    {MONTH_LABELS[Number(r.month.slice(5, 7)) - 1]} {r.month.slice(0, 4)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">{r.invoice_count}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(r.taxable_sales)}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(r.tax_collected)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
