'use client'

import { useEffect, useState } from 'react'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'

interface ReceiptSettings {
  name: string
  tax_id: string | null
  receipt_header: string
  receipt_footer: string
}

// Deliberately more general than store/posStore's CartItem so this same
// component can render a receipt from either live checkout state or a past
// invoice's fetched invoice_items (Riwayat Kasir reprint) — both shapes
// satisfy this.
export interface ReceiptItem {
  product_id: string
  name: string
  unit_price: number
  quantity: number
  unit_label?: string | null
  unit_quantity?: number | null
  notes?: string | null
}

export function Receipt({
  invoiceNumber,
  total,
  items,
  createdAt,
}: {
  invoiceNumber: string
  total: number
  items: ReceiptItem[]
  createdAt: string
}) {
  // Business name/header/footer come from Master Admin > Pengaturan Sistem;
  // falls back to the previous hardcoded look if the fetch fails.
  const [settings, setSettings] = useState<ReceiptSettings | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/receipt-settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setSettings(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-4 text-center">
      <div id="receipt-print-area" className="mx-auto">
        <div className="space-y-1 text-center text-sm text-gray-600 print:text-black">
          <p className="font-bold print:text-base">{settings?.name ?? 'GawEEE'}</p>
          {settings?.receipt_header && <p>{settings.receipt_header}</p>}
          {settings?.tax_id && <p>NPWP: {settings.tax_id}</p>}
          <p>Nomor Struk: {invoiceNumber}</p>
          <p>Waktu: {formatDateTime(createdAt)}</p>
        </div>

        <div className="mt-3 rounded-md border border-gray-200 p-4 text-left text-sm print:mt-2 print:rounded-none print:border-0 print:border-t print:border-b print:border-dashed print:border-black print:p-1 print:font-mono print:text-xs">
          {items.map((item) => (
            <div key={item.product_id} className="py-0.5">
              <div className="flex justify-between">
                <span>
                  {item.name} × {item.unit_label ? `${item.unit_quantity} ${item.unit_label}` : item.quantity}
                </span>
                <span>{formatCurrency(item.unit_price * item.quantity)}</span>
              </div>
              {item.notes && <p className="text-xs text-gray-500 print:text-black">↳ {item.notes}</p>}
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-bold print:border-black">
            <span>TOTAL</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <p className="mt-3 hidden text-center text-xs print:block">{settings?.receipt_footer || 'Terima kasih atas kunjungan Anda!'}</p>
      </div>

      <div className="flex justify-center gap-3 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border-2 border-[var(--brand-500)] px-4 py-2 text-sm font-semibold text-[var(--brand-600)] hover:bg-[var(--brand-50)]"
        >
          🖨️ Cetak Struk
        </button>
      </div>
    </div>
  )
}
