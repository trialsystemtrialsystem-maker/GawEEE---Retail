'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { DateRangePicker, defaultDateRange, type DateRange } from '@/components/ui/DateRangePicker'
import { exportToCsv } from '@/lib/utils/exportCsv'
import { Input } from '@/components/ui/Input'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'

interface InvoiceRow {
  id: string
  invoice_number: string
  customer_name: string | null
  customer_phone: string | null
  cashier_name: string | null
  outlet_name: string | null
  total: number
  discount_amount: number
  payment_status: string
  order_status: string
  created_at: string
}
interface Summary {
  total_revenue: number
  total_discounts: number
  avg_transaction: number
  transactions: number
  voided: number
  unpaid_total: number
}

const PAGE_SIZE = 50

function statusOf(inv: InvoiceRow): { label: string; className: string } {
  if (inv.order_status === 'voided') return { label: 'Dibatalkan', className: 'text-red-500' }
  if (inv.payment_status === 'paid') return { label: 'Lunas', className: 'text-emerald-600' }
  if (inv.payment_status === 'partial') return { label: 'Sebagian', className: 'text-amber-600' }
  return { label: 'Belum lunas', className: 'text-amber-600' }
}

export function InvoiceTable({ scope = 'all' }: { scope?: 'today' | 'all' }) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [range, setRange] = useState<DateRange>(() => defaultDateRange(scope === 'today' ? 1 : 30))
  const [outlet, setOutlet] = useState('all')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const buildParams = useCallback(
    (extra: Record<string, string> = {}) => {
      const params = new URLSearchParams({ start: range.start, end: range.end, ...extra })
      if (outlet !== 'all') params.set('outlet_id', outlet)
      if (status) params.set('status', status)
      if (debouncedSearch) params.set('search', debouncedSearch)
      return params
    },
    [range, outlet, status, debouncedSearch]
  )

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/invoices?${buildParams({ page: String(page), limit: String(PAGE_SIZE) })}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal memuat invoice')
        return
      }
      setInvoices(data.invoices ?? [])
      setSummary(data.summary ?? null)
      setPages(data.pagination?.pages ?? 1)
      setTotal(data.pagination?.total ?? 0)
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setIsLoading(false)
    }
  }, [buildParams, page])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  // Export everything that matches the filters (not just the visible page),
  // fetched only when the button is pressed.
  const [exporting, setExporting] = useState(false)
  async function exportAll() {
    setExporting(true)
    try {
      const rows: InvoiceRow[] = []
      for (let p = 1; p <= 25; p++) {
        const res = await fetch(`/api/invoices?${buildParams({ page: String(p), limit: '200' })}`)
        const data = await res.json()
        if (!res.ok) break
        rows.push(...(data.invoices ?? []))
        if (p >= (data.pagination?.pages ?? 1)) break
      }
      exportToCsv(
        `invoice-${range.start}_${range.end}`,
        rows.map((i) => ({ Invoice: i.invoice_number, Waktu: i.created_at, Outlet: i.outlet_name ?? '', Kasir: i.cashier_name ?? '', Pelanggan: i.customer_name ?? '', Telepon: i.customer_phone ?? '', Diskon: i.discount_amount, Total: i.total, Status: statusOf(i).label }))
      )
    } finally {
      setExporting(false)
    }
  }

  const select = 'rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <OutletSelector value={outlet} onChange={(v) => { setOutlet(v); setPage(1) }} />
        <DateRangePicker value={range} onChange={(r) => { setRange(r); setPage(1) }} />
        <select aria-label="Filter status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className={select}>
          <option value="">Semua Status</option>
          <option value="paid">Lunas</option>
          <option value="unpaid">Belum lunas (piutang)</option>
          <option value="voided">Dibatalkan</option>
        </select>
        <div className="min-w-[14rem] flex-1">
          <Input placeholder="Cari no. invoice, pelanggan, telepon…" aria-label="Cari invoice" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="button" onClick={exportAll} disabled={exporting || total === 0} className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          {exporting ? 'Menyiapkan…' : `⬇ Export CSV (${total})`}
        </button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Card><p className="text-xs text-gray-500">Pendapatan</p><p className="text-lg font-bold text-gray-900">{formatCurrency(summary.total_revenue)}</p><p className="text-xs text-gray-400">{summary.transactions} transaksi</p></Card>
          <Card><p className="text-xs text-gray-500">Rata-rata Transaksi</p><p className="text-lg font-bold text-gray-900">{formatCurrency(summary.avg_transaction)}</p></Card>
          <Card><p className="text-xs text-gray-500">Total Diskon</p><p className="text-lg font-bold text-gray-900">{formatCurrency(summary.total_discounts)}</p></Card>
          <Card><p className="text-xs text-gray-500">Belum Lunas</p><p className={`text-lg font-bold ${summary.unpaid_total > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{formatCurrency(summary.unpaid_total)}</p></Card>
          <Card><p className="text-xs text-gray-500">Dibatalkan</p><p className={`text-lg font-bold ${summary.voided > 0 ? 'text-red-600' : 'text-gray-900'}`}>{summary.voided}</p></Card>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">No. Invoice</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Waktu</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Pelanggan</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Kasir</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Total</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Tidak ada transaksi yang cocok</td></tr>
            ) : (
              invoices.map((inv) => {
                const st = statusOf(inv)
                return (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link href={`/dashboard/sales/${inv.id}`} className="font-medium text-brand-500 hover:underline">{inv.invoice_number}</Link>
                      {inv.outlet_name && outlet === 'all' && <span className="block text-xs text-gray-400">{inv.outlet_name}</span>}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{formatDateTime(inv.created_at)}</td>
                    <td className="px-4 py-2 text-gray-600">{inv.customer_name ?? '-'}</td>
                    <td className="px-4 py-2 text-gray-600">{inv.cashier_name ?? '-'}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(inv.total)}</td>
                    <td className={`px-4 py-2 ${st.className}`}>{st.label}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{total} transaksi · halaman {page} dari {pages}</span>
          <div className="flex gap-2">
            <button className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Sebelumnya</button>
            <button className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Berikutnya →</button>
          </div>
        </div>
      )}
    </div>
  )
}
