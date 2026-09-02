'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'
import { Receipt, type ReceiptItem } from '@/components/pos/Receipt'

interface InvoiceRow {
  id: string
  invoice_number: string
  customer_name: string | null
  total: number
  payment_status: string
  order_status: string
  created_at: string
}

const STATUS_LABEL: Record<string, string> = { paid: 'Lunas', pending: 'Menunggu', partial: 'Sebagian' }
const STATUS_COLOR: Record<string, string> = {
  paid: 'bg-[var(--status-good)]/10 text-[var(--status-good)]',
  pending: 'bg-[var(--status-warning)]/10 text-[var(--status-warning)]',
  partial: 'bg-[var(--status-warning)]/10 text-[var(--status-warning)]',
}

export function CashierHistory() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [reprintId, setReprintId] = useState<string | null>(null)
  const [reprintData, setReprintData] = useState<{ items: ReceiptItem[]; total: number; invoice_number: string; created_at: string } | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/invoices?cashier_id=me&limit=100')
    const data = await res.json()
    if (res.ok) setInvoices(data.invoices ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function openReprint(inv: InvoiceRow) {
    setReprintId(inv.id)
    const res = await fetch(`/api/invoices/${inv.id}`)
    const data = await res.json()
    if (res.ok) {
      const items: ReceiptItem[] = (data.items ?? []).map((it: { product_id: string; products: { name: string } | null; unit_price: number; quantity: number; sold_unit_label: string | null; sold_unit_quantity: number | null }) => ({
        product_id: it.product_id,
        name: it.products?.name ?? it.product_id,
        unit_price: it.unit_price,
        quantity: it.quantity,
        unit_label: it.sold_unit_label,
        unit_quantity: it.sold_unit_quantity,
      }))
      setReprintData({ items, total: data.invoice.total, invoice_number: data.invoice.invoice_number, created_at: data.invoice.created_at })
    }
  }

  const todayTotal = invoices
    .filter((i) => i.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10) && i.order_status !== 'voided')
    .reduce((sum, i) => sum + i.total, 0)
  const todayCount = invoices.filter((i) => i.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length

  if (reprintId && reprintData) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-[var(--brand-100)] bg-white p-6 shadow-lg">
        <button
          type="button"
          onClick={() => {
            setReprintId(null)
            setReprintData(null)
          }}
          className="mb-3 text-sm font-medium text-[var(--brand-600)] hover:underline"
        >
          ← Kembali ke Riwayat
        </button>
        <Receipt
          invoiceNumber={reprintData.invoice_number}
          total={reprintData.total}
          items={reprintData.items}
          createdAt={reprintData.created_at}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-gradient-to-br from-[var(--brand-700)] to-[var(--brand-500)] p-4 text-white shadow-lg">
          <p className="text-xs text-white/80">Total Transaksi Hari Ini</p>
          <p className="text-2xl font-extrabold">{formatCurrency(todayTotal)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--brand-100)] bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Jumlah Transaksi Hari Ini</p>
          <p className="text-2xl font-extrabold text-[var(--brand-900)]">{todayCount}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--brand-100)] bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-[var(--brand-50)]">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-[var(--brand-700)]">No. Invoice</th>
              <th className="px-4 py-2 text-left font-semibold text-[var(--brand-700)]">Waktu</th>
              <th className="px-4 py-2 text-right font-semibold text-[var(--brand-700)]">Total</th>
              <th className="px-4 py-2 text-left font-semibold text-[var(--brand-700)]">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-[var(--brand-700)]">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada transaksi</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-[var(--brand-50)]/40">
                  <td className="px-4 py-2 font-medium text-gray-900">{inv.invoice_number}</td>
                  <td className="px-4 py-2 text-gray-600">{formatDateTime(inv.created_at)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(inv.total)}</td>
                  <td className="px-4 py-2">
                    {inv.order_status === 'voided' ? (
                      <span className="rounded-full bg-[var(--color-danger)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-danger)]">Dibatalkan</span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[inv.payment_status] ?? ''}`}>
                        {STATUS_LABEL[inv.payment_status] ?? inv.payment_status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <button type="button" onClick={() => openReprint(inv)} className="text-xs font-semibold text-[var(--brand-600)] hover:underline">
                      🖨️ Cetak Ulang
                    </button>
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
