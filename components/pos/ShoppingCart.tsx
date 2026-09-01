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
    return <p className="py-8 text-center text-sm text-gray-400">Keranjang masih kosong</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-500">Keranjang ({items.length} item)</h3>
        <ul className="divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.product_id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-lg">
                  {getProductIcon({ name: item.name })}
                </span>
                <div>
                  <p className="font-medium text-gray-900">
                    {item.name}
                    {item.unit_label && (
                      <span className="ml-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-normal text-blue-600">
                        {item.unit_quantity} {item.unit_label}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatCurrency(item.unit_price)} × {item.quantity} ={' '}
                    {formatCurrency(item.unit_price * item.quantity)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Kurangi jumlah"
                  onClick={() => decrement(item.product_id)}
                  className="h-8 w-8 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  −
                </button>
                <span className="w-6 text-center">{item.quantity}</span>
                <button
                  type="button"
                  aria-label="Tambah jumlah"
                  onClick={() => increment(item.product_id)}
                  className="h-8 w-8 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.product_id)}
                  className="ml-1 text-sm text-red-500 hover:underline"
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
        <div className="flex justify-between text-gray-600">
          <span>Diskon</span>
          <span>{formatCurrency(discountAmount)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>PPN 10%</span>
          <span>{formatCurrency(taxAmount)}</span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-bold text-gray-900">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  )
}
