'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'
import { Alert } from '@/components/ui/Alert'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'

interface InvoiceRow {
  id: string
  invoice_number: string
  customer_name: string | null
  total: number
  payment_status: string
  order_status: string
  created_at: string
}

const STATUS_CLASS: Record<string, string> = {
  paid: 'text-emerald-600',
  pending: 'text-amber-600',
  partial: 'text-amber-600',
}

export function InvoiceTable({ scope = 'all' }: { scope?: 'today' | 'all' }) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [summary, setSummary] = useState<{ total_revenue: number; avg_transaction: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (scope === 'today') {
        const today = new Date().toISOString().slice(0, 10)
        params.set('from_date', `${today}T00:00:00`)
        params.set('to_date', `${today}T23:59:59`)
      }
      const res = await fetch(`/api/invoices?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal memuat invoice')
        return
      }
      setInvoices(data.invoices ?? [])
      setSummary(data.summary ?? null)
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setIsLoading(false)
    }
  }, [scope])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  if (error) return <Alert variant="danger">{error}</Alert>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {summary && (
          <div className="flex gap-6 text-sm text-gray-600">
            <span>
              Total Pendapatan: <strong className="text-gray-900">{formatCurrency(summary.total_revenue)}</strong>
            </span>
            <span>
              Rata-rata Transaksi: <strong className="text-gray-900">{formatCurrency(summary.avg_transaction)}</strong>
            </span>
          </div>
        )}
        <ExportCsvButton filename="invoices" rows={invoices} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">No. Invoice</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Waktu</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Pelanggan</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Total</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada transaksi</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/sales/${inv.id}`} className="font-medium text-blue-500 hover:underline">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{formatDateTime(inv.created_at)}</td>
                  <td className="px-4 py-2 text-gray-600">{inv.customer_name ?? '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(inv.total)}</td>
                  <td className="px-4 py-2">
                    {inv.order_status === 'voided' ? (
                      <span className="text-red-500">Dibatalkan</span>
                    ) : (
                      <span className={STATUS_CLASS[inv.payment_status] ?? 'text-gray-600'}>{inv.payment_status}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
