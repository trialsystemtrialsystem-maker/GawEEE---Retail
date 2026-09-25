'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'

interface CustomerRow {
  key: string
  name: string
  phone: string | null
  invoice_count: number
  total_outstanding: number
  max_days_outstanding: number
}
interface InvoiceRow {
  id: string
  invoice_number: string
  customer_name: string
  customer_phone: string | null
  total: number
  balance: number
  created_at: string
  days_outstanding: number
  aging_bucket: string
}
interface BucketRow {
  bucket: string
  amount: number
}

const BUCKET_COLORS: Record<string, string> = {
  '0-30 hari': 'var(--chart-1)',
  '31-60 hari': 'var(--status-warning)',
  '61-90 hari': 'var(--chart-3)',
  '90+ hari': 'var(--status-critical)',
}

export function AccountsReceivableReport({ outletId }: { outletId?: string }) {
  const [byCustomer, setByCustomer] = useState<CustomerRow[]>([])
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [byBucket, setByBucket] = useState<BucketRow[]>([])
  const [note, setNote] = useState('')
  const [selectedOutlet, setSelectedOutlet] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const effectiveOutlet = outletId ?? selectedOutlet

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/reports/accounts-receivable?outlet_id=${effectiveOutlet}`)
    const data = await res.json()
    if (res.ok) {
      setByCustomer(data.byCustomer ?? [])
      setInvoices(data.invoices ?? [])
      setByBucket(data.byBucket ?? [])
      setNote(data.note ?? '')
    }
    setIsLoading(false)
  }, [effectiveOutlet])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const totalOutstanding = byCustomer.reduce((s, r) => s + r.total_outstanding, 0)
  const over60Count = invoices.filter((i) => i.days_outstanding > 60).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>{!outletId && <OutletSelector value={selectedOutlet} onChange={setSelectedOutlet} />}</div>
        <ExportCsvButton filename="accounts-receivable" rows={invoices} />
      </div>

      {note && <Alert variant="info">{note}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Piutang Belum Dibayar</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalOutstanding)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Jumlah Pelanggan</p>
          <p className="text-2xl font-bold text-gray-900">{byCustomer.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Piutang &gt; 60 Hari</p>
          <p className="text-2xl font-bold text-red-600">{over60Count}</p>
        </div>
      </div>

      {!isLoading && byBucket.some((b) => b.amount > 0) && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Umur Piutang (Aging)</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byBucket} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <XAxis dataKey="bucket" tick={{ fill: 'var(--chart-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--chart-muted)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ background: 'var(--chart-surface)', border: '1px solid var(--chart-grid)', borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="amount" name="Piutang" radius={[4, 4, 0, 0]} maxBarSize={48}>
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
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Per Pelanggan</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Pelanggan</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Jumlah Invoice</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Total Piutang</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Umur Terlama</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
              ) : byCustomer.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Tidak ada piutang tertunggak</td></tr>
              ) : (
                byCustomer.map((c) => (
                  <tr key={c.key} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {c.name}
                      {c.phone && <span className="ml-1 font-normal text-gray-400">— {c.phone}</span>}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">{c.invoice_count}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(c.total_outstanding)}</td>
                    <td className={`px-4 py-2 text-right ${c.max_days_outstanding > 60 ? 'font-medium text-red-600' : 'text-gray-500'}`}>{c.max_days_outstanding} hari</td>
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
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Pelanggan</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Total</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Umur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Tidak ada invoice tertunggak</td></tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-gray-800">{inv.invoice_number}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {inv.customer_name}
                      {inv.customer_phone && <span className="ml-1 text-gray-400">— {inv.customer_phone}</span>}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{formatDateTime(inv.created_at)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(inv.balance)}{inv.balance < inv.total && <span className="block text-xs font-normal text-gray-400">dari {formatCurrency(inv.total)}</span>}</td>
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
