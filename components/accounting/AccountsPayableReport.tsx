'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'

interface SupplierRow {
  supplier_id: string
  supplier_name: string
  invoice_count: number
  total_outstanding: number
  max_days_overdue: number
}
interface InvoiceRow {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  supplier_name: string
  total: number
  paid: number
  outstanding: number
  days_overdue: number
  aging_bucket: string
}
interface BucketRow {
  bucket: string
  amount: number
}

const BUCKET_COLORS: Record<string, string> = {
  'Belum jatuh tempo': 'var(--status-good)',
  '1-30 hari': 'var(--chart-1)',
  '31-60 hari': 'var(--status-warning)',
  '61-90 hari': 'var(--chart-3)',
  '90+ hari': 'var(--status-critical)',
}

export function AccountsPayableReport({ outletId }: { outletId: string }) {
  const [bySupplier, setBySupplier] = useState<SupplierRow[]>([])
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [byBucket, setByBucket] = useState<BucketRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/reports/accounts-payable')
    const data = await res.json()
    if (res.ok) {
      setBySupplier(data.bySupplier ?? [])
      setInvoices(data.invoices ?? [])
      setByBucket(data.byBucket ?? [])
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load, outletId])

  const totalOutstanding = bySupplier.reduce((s, r) => s + r.total_outstanding, 0)
  const overdueCount = invoices.filter((i) => i.days_overdue > 0).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Hutang Belum Dibayar</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalOutstanding)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Jumlah Supplier</p>
          <p className="text-2xl font-bold text-gray-900">{bySupplier.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Invoice Lewat Jatuh Tempo</p>
          <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
        </div>
      </div>

      {!isLoading && byBucket.some((b) => b.amount > 0) && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Umur Hutang (Aging)</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byBucket} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <XAxis dataKey="bucket" tick={{ fill: 'var(--chart-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--chart-muted)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ background: 'var(--chart-surface)', border: '1px solid var(--chart-grid)', borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="amount" name="Hutang" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {byBucket.map((b) => (
                    <Cell key={b.bucket} fill={BUCKET_COLORS[b.bucket] ?? 'var(--chart-1)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Per Supplier</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Supplier</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Jumlah Invoice</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Total Hutang</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Terlama Lewat Jatuh Tempo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
              ) : bySupplier.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Tidak ada hutang tertunggak</td></tr>
              ) : (
                bySupplier.map((s) => (
                  <tr key={s.supplier_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{s.supplier_name}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{s.invoice_count}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(s.total_outstanding)}</td>
                    <td className={`px-4 py-2 text-right ${s.max_days_overdue > 0 ? 'font-medium text-red-600' : 'text-gray-500'}`}>
                      {s.max_days_overdue > 0 ? `${s.max_days_overdue} hari` : 'Belum jatuh tempo'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Rincian Invoice</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">No. Invoice</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Supplier</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Jatuh Tempo</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Total</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Sudah Dibayar</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Sisa</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Umur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Tidak ada invoice tertunggak</td></tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-gray-800">{inv.invoice_number}</td>
                    <td className="px-4 py-2 text-gray-700">{inv.supplier_name}</td>
                    <td className="px-4 py-2 text-gray-600">{formatDate(inv.due_date)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(inv.total)}</td>
                    <td className="px-4 py-2 text-right text-emerald-600">{formatCurrency(inv.paid)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(inv.outstanding)}</td>
                    <td className="px-4 py-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: `color-mix(in srgb, ${BUCKET_COLORS[inv.aging_bucket] ?? 'var(--chart-1)'} 15%, white)`, color: BUCKET_COLORS[inv.aging_bucket] ?? 'var(--chart-1)' }}
                      >
                        {inv.aging_bucket}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
