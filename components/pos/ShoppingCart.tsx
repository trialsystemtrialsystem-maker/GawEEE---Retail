'use client'

import { usePosStore } from '@/store/posStore'
import { formatCurrency } from '@/lib/utils/formatting'
import { getProductIcon } from '@/lib/utils/productIcon'

export function ShoppingCart() {
  const items = usePosStore((s) => s.items)
  const increment = usePosStore((s) => s.incrementItem)
  const decrement = usePosStore((s) => s.decrementItem)
  const removeItem = usePosStore((s) => s.removeItem)
  const subtotal = usePosStore((s) => s.subtotal())
  const taxAmount = usePosStore((s) => s.taxAmount())
  const discountAmount = usePosStore((s) => s.discountAmount)
  const total = usePosStore((s) => s.total())

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <span aria-hidden className="text-4xl opacity-40">🛒</span>
        <p className="text-sm text-gray-400">Keranjang masih kosong — scan atau pilih produk</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--brand-700)]">Keranjang ({items.length} item)</h3>
        <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
          {items.map((item) => (
            <li key={item.product_id} className="flex items-center justify-between py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-50)] text-lg">
                  {getProductIcon({ name: item.name })}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">
                    {item.name}
                    {item.unit_label && (
                      <span className="ml-1.5 whitespace-nowrap rounded-full bg-[var(--brand-50)] px-2 py-0.5 text-xs font-normal text-[var(--brand-600)]">
                        {item.unit_quantity} {item.unit_label}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatCurrency(item.unit_price)} × {item.quantity} ={' '}
                    <span className="font-semibold text-gray-700">{formatCurrency(item.unit_price * item.quantity)}</span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Kurangi jumlah"
                  onClick={() => decrement(item.product_id)}
                  className="h-8 w-8 rounded-full border-2 border-[var(--brand-100)] font-bold text-[var(--brand-600)] hover:bg-[var(--brand-50)]"
                >
                  −
                </button>
                <span className="w-6 text-center font-semibold">{item.quantity}</span>
                <button
                  type="button"
                  aria-label="Tambah jumlah"
                  onClick={() => increment(item.product_id)}
                  className="h-8 w-8 rounded-full border-2 border-[var(--brand-100)] font-bold text-[var(--brand-600)] hover:bg-[var(--brand-50)]"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.product_id)}
                  className="ml-1 text-sm text-[var(--color-danger)] hover:underline"
                >
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1 border-t border-gray-200 pt-3 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-[var(--status-good)]">
            <span>Diskon</span>
            <span>-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-gray-600">
          <span>PPN 10%</span>
          <span>{formatCurrency(taxAmount)}</span>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-[var(--brand-900)] to-[var(--brand-700)] px-4 py-3">
        <span className="text-sm font-medium text-white/80">Total</span>
        <span className="text-xl font-extrabold text-white">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}
