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
      <div className="text-4xl">✅</div>
      <h2 className="text-xl font-bold text-gray-900">PEMBAYARAN BERHASIL</h2>

      <div className="space-y-1 text-sm text-gray-600">
        <p>Nomor Struk: {invoiceNumber}</p>
        <p>Waktu: {formatDateTime(createdAt)}</p>
        <p className="font-semibold text-gray-900">Total Bayar: {formatCurrency(total)}</p>
      </div>

      <div className="rounded-md border border-gray-200 p-4 text-left text-sm">
        {items.map((item) => (
          <div key={item.product_id} className="flex justify-between py-0.5">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span>{formatCurrency(item.unit_price * item.quantity)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-bold">
          <span>TOTAL</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border-2 border-blue-500 px-4 py-2 text-sm font-semibold text-blue-500 hover:bg-blue-50"
        >
          Cetak Struk
        </button>
      </div>
    </div>
  )
}
