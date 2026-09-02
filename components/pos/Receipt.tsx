'use client'

import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'
import type { CartItem } from '@/store/posStore'

export function Receipt({
  invoiceNumber,
  total,
  items,
  createdAt,
}: {
  invoiceNumber: string
  total: number
  items: CartItem[]
  createdAt: string
}) {
  return (
    <div className="space-y-4 text-center">
      <div id="receipt-print-area" className="mx-auto">
        <div className="space-y-1 text-center text-sm text-gray-600 print:text-black">
          <p className="font-bold print:text-base">GawEEE</p>
          <p>Nomor Struk: {invoiceNumber}</p>
          <p>Waktu: {formatDateTime(createdAt)}</p>
        </div>

        <div className="mt-3 rounded-md border border-gray-200 p-4 text-left text-sm print:mt-2 print:rounded-none print:border-0 print:border-t print:border-b print:border-dashed print:border-black print:p-1 print:font-mono print:text-xs">
          {items.map((item) => (
            <div key={item.product_id} className="flex justify-between py-0.5">
              <span>
                {item.name} × {item.unit_label ? `${item.unit_quantity} ${item.unit_label}` : item.quantity}
              </span>
              <span>{formatCurrency(item.unit_price * item.quantity)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-bold print:border-black">
            <span>TOTAL</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <p className="mt-3 hidden text-center text-xs print:block">Terima kasih atas kunjungan Anda!</p>
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
