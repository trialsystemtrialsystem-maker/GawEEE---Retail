'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils/formatting'

interface Breakdown {
  paymentMethods: { method: string; total: number }[]
  bestProducts: { product_id: string; name: string; quantity: number; revenue: number }[]
  cashierSales: { cashier_id: string; name: string; revenue: number; transactions: number; commission: number }[]
  fraudWatchlist: { id: string; total: number; voided_at: string | null; voided_by_name: string; reason: string }[]
  orderChannel: { inStore: number; online: number }
  lowStock: { product_id: string; name: string; quantity_on_hand: number; reorder_level: number }[]
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Tunai',
  e_wallet: 'E-Wallet',
  bank_transfer: 'Transfer Bank',
  card: 'Kartu',
}

// Fixed categorical order per the dataviz skill — never re-ordered by value.
const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']

function ReportCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col">
      <h3 className="mb-3 text-base font-semibold text-gray-900">{title}</h3>
      {children}
    </Card>
  )
}

function EmptyState({ label }: { label: string }) {
  return <p className="py-8 text-center text-sm text-gray-400">{label}</p>
}

export function SalesReportGrid({ days }: { days: number }) {
  const [data, setData] = useState<Breakdown | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/reports/sales-breakdown?days=${days}`)
    const json = await res.json()
    if (res.ok) setData(json)
  }, [days])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  if (!data) return <p className="text-sm text-gray-400">Memuat laporan…</p>

  const paymentTotal = data.paymentMethods.reduce((s, p) => s + p.total, 0)
  const channelTotal = data.orderChannel.inStore + data.orderChannel.online

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <ReportCard title="Metode Pembayaran">
        {data.paymentMethods.length === 0 ? (
          <EmptyState label="Belum ada transaksi" />
        ) : (
          <ul className="space-y-2">
            {data.paymentMethods.map((p, i) => (
              <li key={p.method} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-700">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {PAYMENT_LABEL[p.method] ?? p.method}
                </span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(p.total)} {paymentTotal > 0 && `(${Math.round((p.total / paymentTotal) * 100)}%)`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ReportCard>

      <ReportCard title="Order Type">
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-gray-700">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[0] }} />
              Di Toko
            </span>
            <span className="font-medium text-gray-900">
              {formatCurrency(data.orderChannel.inStore)}{' '}
              {channelTotal > 0 && `(${Math.round((data.orderChannel.inStore / channelTotal) * 100)}%)`}
            </span>
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-gray-700">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[1] }} />
              Online
            </span>
            <span className="font-medium text-gray-900">{formatCurrency(data.orderChannel.online)}</span>
          </li>
        </ul>
      </ReportCard>

      <ReportCard title="Produk Terlaris">
        {data.bestProducts.length === 0 ? (
          <EmptyState label="Belum ada transaksi" />
        ) : (
          <ol className="space-y-2 text-sm">
            {data.bestProducts.slice(0, 5).map((p, i) => (
              <li key={p.product_id} className="flex items-center justify-between">
                <span className="text-gray-700">
                  {i + 1}. {p.name}
                </span>
                <span className="font-medium text-gray-900">{p.quantity}x</span>
              </li>
            ))}
          </ol>
        )}
      </ReportCard>

      <ReportCard title="Stok Terendah">
        {data.lowStock.length === 0 ? (
          <EmptyState label="Semua stok aman" />
        ) : (
          <ul className="space-y-2 text-sm">
            {data.lowStock.map((s) => (
              <li key={s.product_id} className="flex items-center justify-between">
                <span className="text-gray-700">{s.name}</span>
                <span className="font-medium" style={{ color: 'var(--status-warning)' }}>
                  {s.quantity_on_hand}/{s.reorder_level}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ReportCard>

      <ReportCard title="Penjualan per Kasir">
        {data.cashierSales.length === 0 ? (
          <EmptyState label="Belum ada transaksi" />
        ) : (
          <ul className="space-y-2 text-sm">
            {data.cashierSales.map((c) => (
              <li key={c.cashier_id} className="flex items-center justify-between">
                <span className="text-gray-700">{c.name}</span>
                <span className="font-medium text-gray-900">{formatCurrency(c.revenue)}</span>
              </li>
            ))}
          </ul>
        )}
      </ReportCard>

      <ReportCard title="Komisi per Kasir">
        {data.cashierSales.every((c) => c.commission === 0) ? (
          <EmptyState label="Belum ada komisi diatur (Staff → set commission rate)" />
        ) : (
          <ul className="space-y-2 text-sm">
            {data.cashierSales.map((c) => (
              <li key={c.cashier_id} className="flex items-center justify-between">
                <span className="text-gray-700">{c.name}</span>
                <span className="font-medium text-gray-900">{formatCurrency(c.commission)}</span>
              </li>
            ))}
          </ul>
        )}
      </ReportCard>

      <ReportCard title="Fraud Control">
        {data.fraudWatchlist.length === 0 ? (
          <EmptyState label="Tidak ada transaksi dibatalkan" />
        ) : (
          <ul className="space-y-2 text-sm">
            {data.fraudWatchlist.slice(0, 5).map((f) => (
              <li key={f.id} className="border-l-2 pl-2" style={{ borderColor: 'var(--status-serious)' }}>
                <p className="text-gray-700">
                  {formatCurrency(f.total)} dibatalkan oleh {f.voided_by_name}
                </p>
                <p className="text-xs text-gray-400">{f.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </ReportCard>

      <ReportCard title="Sales per Transaction">
        <ul className="space-y-2 text-sm">
          {data.cashierSales.length === 0 ? (
            <EmptyState label="Belum ada transaksi" />
          ) : (
            data.cashierSales.map((c) => (
              <li key={c.cashier_id} className="flex items-center justify-between">
                <span className="text-gray-700">{c.name}</span>
                <span className="font-medium text-gray-900">
                  {c.transactions > 0 ? formatCurrency(c.revenue / c.transactions) : formatCurrency(0)}
                </span>
              </li>
            ))
          )}
        </ul>
      </ReportCard>
    </div>
  )
}
