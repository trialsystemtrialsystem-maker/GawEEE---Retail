'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils/formatting'

interface ModifierOption {
  id: string
  label: string
  linked_product_id: string | null
  products: { name: string; sku: string; selling_price: number } | null
}
interface ModifierGroup {
  id: string
  name: string
  product_modifier_options: ModifierOption[]
}
interface InventoryItem {
  product_id: string
  name: string
  sku: string
  unit_price: number
}

// Shown instead of adding straight to cart when a product has modifier
// groups defined (see Phase 13 Batch A item 3). One choice per group: a
// priced option (linked_product_id set) is added to the cart as its own
// line via the normal addItem path — zero create_invoice() changes since it
// only ever adds a real product; an unpriced option is folded into a note
// attached to the base product's cart line via the existing notes mechanism
// (item 2 / Notes Category).
export function ModifierPickerModal({
  item,
  groups,
  onConfirm,
  onClose,
}: {
  item: InventoryItem
  groups: ModifierGroup[]
  onConfirm: (args: { selectedOptions: ModifierOption[] }) => void
  onClose: () => void
}) {
  const [picked, setPicked] = useState<Record<string, string>>({})

  function pick(groupId: string, optionId: string) {
    setPicked((p) => ({ ...p, [groupId]: optionId }))
  }

  function handleConfirm() {
    const selectedOptions = Object.values(picked)
      .map((optId) => groups.flatMap((g) => g.product_modifier_options).find((o) => o.id === optId))
      .filter((o): o is ModifierOption => !!o)
    onConfirm({ selectedOptions })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 font-semibold text-gray-900">{item.name}</h3>
        <div className="max-h-96 space-y-4 overflow-y-auto">
          {groups.map((g) => (
            <div key={g.id}>
              <p className="mb-1.5 text-sm font-semibold text-gray-700">{g.name}</p>
              <div className="space-y-1.5">
                {g.product_modifier_options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => pick(g.id, o.id)}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                      picked[g.id] === o.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                    }`}
                  >
                    <span>{o.label}</span>
                    {o.products ? (
                      <span className="font-medium text-emerald-600">+{formatCurrency(o.products.selling_price)}</span>
                    ) : (
                      <span className="text-xs text-gray-400">gratis</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-md border border-gray-200 py-2 text-center text-sm text-gray-500 hover:bg-gray-50">
            Batal
          </button>
          <button type="button" onClick={handleConfirm} className="flex-1 rounded-md bg-emerald-600 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-700">
            Tambah ke Keranjang
          </button>
        </div>
      </div>
    </div>
  )
}
