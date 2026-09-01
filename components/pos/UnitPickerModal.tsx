'use client'

import { formatCurrency } from '@/lib/utils/formatting'

interface InventoryItem {
  product_id: string
  name: string
  sku: string
  unit_price: number
}
interface ProductUnit {
  id: string
  unit_label: string
  conversion_to_base: number
  unit_price: number
}

// Shown instead of adding straight to cart when a product has extra units
// (see Phase 11 plan item 10). Picking a bulk unit converts to an ordinary
// base-unit quantity + a per-item discount absorbing the price gap — the
// cart/checkout math is otherwise unchanged, create_invoice() needs no
// changes.
export function UnitPickerModal({
  item,
  units,
  onPick,
  onClose,
}: {
  item: InventoryItem
  units: ProductUnit[]
  onPick: (args: { unitPrice: number; quantity: number; discount?: number; unitLabel?: string; unitQuantity?: number }) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 font-semibold text-gray-900">{item.name}</h3>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onPick({ unitPrice: item.unit_price, quantity: 1 })}
            className="flex w-full items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-left text-sm hover:border-blue-400 hover:bg-blue-50"
          >
            <span>Satuan Dasar</span>
            <span className="font-medium text-gray-900">{formatCurrency(item.unit_price)}</span>
          </button>
          {units.map((u) => {
            const normalPrice = item.unit_price * u.conversion_to_base
            const discount = Math.max(0, normalPrice - u.unit_price)
            const effectiveUnitPrice = Math.round(u.unit_price / u.conversion_to_base)
            return (
              <button
                key={u.id}
                type="button"
                onClick={() =>
                  onPick({
                    unitPrice: effectiveUnitPrice,
                    quantity: u.conversion_to_base,
                    discount: discount > 0 ? discount : undefined,
                    unitLabel: u.unit_label,
                    unitQuantity: 1,
                  })
                }
                className="flex w-full items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-left text-sm hover:border-blue-400 hover:bg-blue-50"
              >
                <span>
                  {u.unit_label} ({u.conversion_to_base}x satuan dasar)
                  {discount > 0 && <span className="ml-1 text-xs text-emerald-600">hemat {formatCurrency(discount)}</span>}
                </span>
                <span className="font-medium text-gray-900">{formatCurrency(u.unit_price)}</span>
              </button>
            )
          })}
        </div>
        <button type="button" onClick={onClose} className="mt-3 w-full text-center text-sm text-gray-500 hover:underline">
          Batal
        </button>
      </div>
    </div>
  )
}
